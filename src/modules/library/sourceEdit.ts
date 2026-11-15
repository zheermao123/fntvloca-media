/**
 * B2 编辑媒体源（Phase 1 后端，纯逻辑）。
 * 部分更新语义：id 不可改、type/private 不可改；WebDAV 密码三态 keep/replace/clear。
 * 加密动作以 plan 返回给 handler，在 main 使用现有 encryptSecret 执行（本模块保持纯函数可测）。
 */
import type { SourceConfig } from './types';

export const SOURCE_CATEGORIES = ['movie', 'tv', 'anime', 'other'] as const;

export type SourceUpdatePatch = {
    id: string;
    name?: string;
    rootPath?: string;
    url?: string;
    username?: string;
    /** undefined/'' = keep；null = clear；非空字符串 = replace */
    password?: string | null;
    category?: string;
};

export type SourceUpdatePlan = {
    next: SourceConfig;
    passwordAction: 'keep' | 'replace' | 'clear';
    replacePassword?: string;
};

export type SourceUpdateResult =
    | { ok: true; plan: SourceUpdatePlan }
    | { ok: false; code: string; message: string };

const ALLOWED_PATCH_FIELDS = new Set(['id', 'name', 'rootPath', 'url', 'username', 'password', 'category']);

export function normalizeCategoryValue(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const v = value.trim();
    return (SOURCE_CATEGORIES as readonly string[]).includes(v) ? v : null;
}

export function planSourceUpdate(current: SourceConfig, patch: SourceUpdatePatch): SourceUpdateResult {
    if (!patch || typeof patch !== 'object') {
        return { ok: false, code: 'INVALID_PATCH', message: '参数无效' };
    }
    for (const key of Object.keys(patch)) {
        if (!ALLOWED_PATCH_FIELDS.has(key)) {
            return { ok: false, code: 'INVALID_FIELD', message: `不支持的字段: ${key}` };
        }
    }
    if (patch.id !== current.id) {
        return { ok: false, code: 'INVALID_ID', message: '源 ID 不可修改' };
    }

    const config: Record<string, string> = { ...current.config };
    let name = current.name;

    if (patch.name !== undefined) {
        const trimmed = patch.name.trim();
        if (!trimmed) {
            return { ok: false, code: 'INVALID_NAME', message: '名称不能为空' };
        }
        name = trimmed;
    }
    if (patch.category !== undefined) {
        const category = normalizeCategoryValue(patch.category);
        if (!category) {
            return { ok: false, code: 'INVALID_CATEGORY', message: '无效的内容类型' };
        }
        config.category = category;
    }

    let passwordAction: SourceUpdatePlan['passwordAction'] = 'keep';
    let replacePassword: string | undefined;

    if (current.type === 'local') {
        if (patch.url !== undefined || patch.username !== undefined || patch.password !== undefined) {
            return { ok: false, code: 'INVALID_FIELD', message: '本地源不支持该字段' };
        }
        if (patch.rootPath !== undefined) {
            const rootPath = patch.rootPath.trim();
            if (!rootPath) {
                return { ok: false, code: 'INVALID_ROOT', message: '扫描目录不能为空' };
            }
            config.rootPath = rootPath;
        }
    } else if (current.type === 'webdav') {
        if (patch.rootPath !== undefined) {
            return { ok: false, code: 'INVALID_FIELD', message: 'WebDAV 源不支持该字段' };
        }
        if (patch.url !== undefined) {
            const url = patch.url.trim().replace(/\/+$/, '');
            if (!url || !/^https?:\/\//i.test(url)) {
                return { ok: false, code: 'INVALID_URL', message: 'WebDAV 地址无效' };
            }
            config.url = url;
        }
        if (patch.username !== undefined) {
            config.username = patch.username.trim();
        }
        if (patch.password !== undefined) {
            if (patch.password === null) {
                passwordAction = 'clear';
                config.passwordEnc = '';
            } else if (patch.password !== '') {
                passwordAction = 'replace';
                replacePassword = patch.password;
            }
        }
    } else {
        return { ok: false, code: 'UNSUPPORTED_TYPE', message: '暂不支持该源类型' };
    }

    return {
        ok: true,
        plan: {
            next: { ...current, name, config },
            passwordAction,
            replacePassword,
        },
    };
}
