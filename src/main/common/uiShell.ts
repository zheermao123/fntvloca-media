/**
 * UI shell 解析（Phase 1：classic / react 双壳）。
 *
 * 规则（决策：普通用户缺省 classic；开发环境可用显式环境变量强制 react）：
 * - 打包环境：始终 classic（Phase 1 不改变用户缺省值）。
 * - 开发环境：仅当 FNTV_UI_SHELL=react 时才考虑 react；
 *   - 若提供合法的 loopback Vite 开发地址（FNTV_UI2_DEV_URL）→ 加载开发服务器；
 *   - 否则若 ui2-renderer/index.html 已构建 → 加载本地构建产物；
 *   - 否则回退 classic（React 资源缺失）。
 * 加载失败时的回退由调用方保证"只回退一次"。
 */

export type UiShell = 'classic' | 'react';

/** 固定 loopback 开发端口（与 scripts/ui2-dev.mjs 保持一致） */
export const UI2_DEV_HOST = '127.0.0.1';
export const UI2_DEV_PORT = 5273;

export type UiShellOptions = {
    isPackaged: boolean;
    envShell: string | undefined;
    envDevServerUrl: string | undefined;
    reactEntryExists: boolean;
};

export type UiShellResolution = {
    shell: UiShell;
    /** 非空表示使用 Vite 开发服务器地址（仅开发环境、react 模式） */
    devServerUrl: string | null;
};

/** 仅接受 http://127.0.0.1|localhost:<固定端口> 的 loopback 开发地址，其余一律拒绝 */
export function normalizeLoopbackDevUrl(raw: string | undefined): string | null {
    if (!raw) {
        return null;
    }
    try {
        const url = new URL(raw);
        if (url.protocol !== 'http:') {
            return null;
        }
        const hostname = url.hostname.toLowerCase();
        if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
            return null;
        }
        if (url.port !== String(UI2_DEV_PORT)) {
            return null;
        }
        return `http://${UI2_DEV_HOST}:${UI2_DEV_PORT}/`;
    } catch {
        return null;
    }
}

export function resolveUiShell(options: UiShellOptions): UiShellResolution {
    if (options.isPackaged) {
        return { shell: 'classic', devServerUrl: null };
    }
    if ((options.envShell ?? '').trim().toLowerCase() !== 'react') {
        return { shell: 'classic', devServerUrl: null };
    }
    const devServerUrl = normalizeLoopbackDevUrl(options.envDevServerUrl);
    if (devServerUrl) {
        return { shell: 'react', devServerUrl };
    }
    if (options.reactEntryExists) {
        return { shell: 'react', devServerUrl: null };
    }
    return { shell: 'classic', devServerUrl: null };
}
