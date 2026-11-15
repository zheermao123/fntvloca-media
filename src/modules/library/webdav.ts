import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { isVideoFile, shouldSkipDirectory } from './scanner';
import type { ScanError, ScanResult, ScannedFile } from './scanner';

export type WebdavCredentials = {
    /** 服务器地址（可含子路径，如 https://nas.example:5006/dav） */
    baseUrl: string;
    username?: string;
    password?: string;
    timeoutMs?: number;
};

export type WebdavEntry = {
    href: string;
    isDirectory: boolean;
    size: number;
    mtime: number;
    contentType: string | null;
};

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getcontenttype/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

export function buildPropfindBody(): string {
    return PROPFIND_BODY;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function asArray(value: unknown): unknown[] {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function pickString(value: unknown): string | null {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    return null;
}

function pickNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/** 解析 PROPFIND(Depth:1) 响应为条目列表；无效内容返回空数组 */
export function parsePropfindResponse(xml: string, requestUrl: string): WebdavEntry[] {
    if (typeof xml !== 'string' || xml.trim().length === 0) {
        return [];
    }
    const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, trimValues: true });
    let parsed: unknown;
    try {
        parsed = parser.parse(xml);
    } catch {
        return [];
    }
    const multistatus = asRecord(asRecord(parsed)?.multistatus);
    if (!multistatus) {
        return [];
    }

    const entries: WebdavEntry[] = [];
    for (const rawResponse of asArray(multistatus.response)) {
        const response = asRecord(rawResponse);
        if (!response) {
            continue;
        }
        const href = pickString(response.href);
        if (!href) {
            continue;
        }
        let absolute: string;
        try {
            absolute = new URL(href, requestUrl).toString();
        } catch {
            continue;
        }

        let prop: Record<string, unknown> | null = null;
        for (const rawPropstat of asArray(response.propstat)) {
            const candidate = asRecord(asRecord(rawPropstat)?.prop);
            if (candidate) {
                prop = candidate;
                break;
            }
        }
        if (!prop) {
            continue;
        }

        const resourceType = asRecord(prop.resourcetype);
        const isDirectory = resourceType !== null && resourceType.collection !== undefined;
        const mtimeRaw = pickString(prop.getlastmodified);
        const parsedMtime = mtimeRaw ? Date.parse(mtimeRaw) : Number.NaN;

        entries.push({
            href: absolute,
            isDirectory,
            size: pickNumber(prop.getcontentlength) ?? 0,
            mtime: Number.isFinite(parsedMtime) ? parsedMtime : 0,
            contentType: pickString(prop.getcontenttype),
        });
    }
    return entries;
}

function normalizeUrl(value: string): string {
    return value.replace(/\/+$/, '');
}

export type WebdavProbeReason = 'auth' | 'not_found' | 'network' | 'timeout';

export type WebdavProbeResult =
    | { ok: true; status: number }
    | { ok: false; reason: WebdavProbeReason; message: string };

export type WebdavProbeOptions = {
    /** 单次根探测超时（毫秒），默认 5000（规格 §0.5） */
    timeoutMs?: number;
    /** 测试注入点：替换 axios 请求实现，不出真实网络请求 */
    request?: (config: {
        url: string;
        method: string;
        data: string;
        headers: Record<string, string>;
        auth?: { username: string; password: string };
        timeout: number;
    }) => Promise<{ status: number }>;
};

/** 剥离消息中 URL 内嵌的用户名/密码（脱敏） */
export function sanitizeProbeMessage(message: string): string {
    return message.replace(/\/\/[^/@\s]+@/g, '//***@');
}

/**
 * WebDAV 根目录单次探测（PROPFIND Depth:0，超时 5s，不递归扫描）。
 * 仅用于媒体源连接测试（B1）；认证信息只在请求内使用，不记录、不回显。
 */
export async function probeWebdavRoot(
    credentials: WebdavCredentials,
    options?: WebdavProbeOptions
): Promise<WebdavProbeResult> {
    const rawBase = credentials.baseUrl.trim();
    if (!rawBase) {
        return { ok: false, reason: 'network', message: 'WebDAV 地址为空' };
    }
    let parsed: URL;
    try {
        parsed = new URL(rawBase);
    } catch {
        return { ok: false, reason: 'network', message: 'WebDAV 地址格式无效' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, reason: 'network', message: '仅支持 http/https 地址' };
    }
    const rootUrl = rawBase.replace(/\/+$/, '') + '/';
    const timeout = options?.timeoutMs ?? credentials.timeoutMs ?? 5000;
    const auth = credentials.username !== undefined
        ? { username: credentials.username, password: credentials.password ?? '' }
        : undefined;
    const headers: Record<string, string> = { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' };
    try {
        const response = options?.request
            ? await options.request({ url: rootUrl, method: 'PROPFIND', data: buildPropfindBody(), headers, auth, timeout })
            : await axios.create({ timeout, maxRedirects: 5, auth, headers }).request({
                url: rootUrl,
                method: 'PROPFIND',
                data: buildPropfindBody(),
            });
        if (response.status === 200 || response.status === 207) {
            return { ok: true, status: response.status };
        }
        if (response.status === 401 || response.status === 403) {
            return { ok: false, reason: 'auth', message: '认证失败或无权访问' };
        }
        if (response.status === 404) {
            return { ok: false, reason: 'not_found', message: '地址不存在' };
        }
        return { ok: false, reason: 'network', message: `服务器返回异常状态 ${response.status}` };
    } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
            return { ok: false, reason: 'auth', message: '认证失败或无权访问' };
        }
        if (status === 404) {
            return { ok: false, reason: 'not_found', message: '地址不存在' };
        }
        const code = (error as { code?: string })?.code;
        if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
            return { ok: false, reason: 'timeout', message: '连接超时' };
        }
        const raw = error instanceof Error ? error.message : String(error);
        return { ok: false, reason: 'network', message: sanitizeProbeMessage(raw).slice(0, 200) };
    }
}
export type WebdavScanOptions = {
    maxDepth?: number;
    maxFiles?: number;
    onProgress?: (scanned: number) => void;
};

/** 递归扫描 WebDAV 目录，产出与本地扫描一致的 ScanResult（path 为完整 URL） */
export async function scanWebdavFolder(
    credentials: WebdavCredentials,
    options?: WebdavScanOptions
): Promise<ScanResult> {
    const maxDepth = options?.maxDepth ?? 12;
    const maxFiles = options?.maxFiles ?? 20000;
    const files: ScannedFile[] = [];
    const errors: ScanError[] = [];
    let truncated = false;

    const client = axios.create({
        timeout: credentials.timeoutMs ?? 15000,
        maxRedirects: 5,
        auth: credentials.username !== undefined
            ? { username: credentials.username, password: credentials.password ?? '' }
            : undefined,
        headers: {
            Depth: '1',
            'Content-Type': 'application/xml; charset=utf-8',
        },
    });

    const rawBase = credentials.baseUrl.trim();
    if (rawBase.length === 0) {
        return { files, errors: [{ path: credentials.baseUrl, message: 'WebDAV 地址为空' }], truncated };
    }
    // 集合地址统一保留尾斜杠：部分服务器对无斜杠的目录请求返回 404/301
    const rootUrl = rawBase.replace(/\/+$/, '') + '/';

    const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            break;
        }
        if (current.depth > maxDepth) {
            continue;
        }

        let entries: WebdavEntry[];
        try {
            const response = await client.request<string>({
                url: current.url,
                method: 'PROPFIND',
                data: buildPropfindBody(),
            });
            entries = parsePropfindResponse(String(response.data), current.url);
        } catch (error) {
            errors.push({
                path: current.url,
                message: error instanceof Error ? error.message : String(error),
            });
            continue;
        }

        for (const entry of entries) {
            if (normalizeUrl(entry.href) === normalizeUrl(current.url)) {
                continue;
            }
            const rawName = entry.href.split('/').filter((segment) => segment.length > 0).pop() ?? '';
            const name = safeDecode(rawName);
            if (name.length === 0) {
                continue;
            }
            if (entry.isDirectory) {
                if (!shouldSkipDirectory(name)) {
                    queue.push({ url: entry.href, depth: current.depth + 1 });
                }
                continue;
            }
            if (!isVideoFile(name)) {
                continue;
            }
            if (files.length >= maxFiles) {
                truncated = true;
                queue.length = 0;
                break;
            }
            files.push({
                path: entry.href,
                size: entry.size,
                mtime: entry.mtime,
                isSample: /\bsample\b/i.test(name),
            });
            if (options?.onProgress && files.length % 200 === 0) {
                options.onProgress(files.length);
            }
        }
    }

    return { files, errors, truncated };
}
