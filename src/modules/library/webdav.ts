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
