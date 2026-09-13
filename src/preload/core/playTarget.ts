const GUID_PATTERN = /^(?:[a-z][a-z0-9]*_)?[a-f0-9]{32}$/i;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ROUTE_MARKERS = new Set(['movie', 'episode', 'other', 'video', 'detail', 'item', 'play']);
const QUERY_KEYS = ['item_guid', 'itemGuid', 'guid', 'id'];

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function normalizeCandidate(value: string | null | undefined): string | null {
    if (!value) return null;

    const candidate = safeDecode(value).trim();
    if (!candidate || candidate.length > 128 || /[/?#&=]/.test(candidate)) return null;
    return candidate;
}

function extractFromPath(path: string): string | null {
    const segments = path
        .split('/')
        .map(normalizeCandidate)
        .filter((segment): segment is string => Boolean(segment));

    for (let index = segments.length - 2; index >= 0; index -= 1) {
        if (!ROUTE_MARKERS.has(segments[index].toLowerCase())) continue;
        const candidate = segments[index + 1];
        if (candidate && !ROUTE_MARKERS.has(candidate.toLowerCase())) return candidate;
    }

    for (let index = segments.length - 1; index >= 0; index -= 1) {
        const candidate = segments[index];
        if (GUID_PATTERN.test(candidate) || UUID_PATTERN.test(candidate)) return candidate;
    }

    return null;
}

/**
 * 从飞牛影视的新旧详情页 URL 中提取播放项标识。
 * 路由结构优先于 GUID 格式，避免服务端以后更换标识格式时再次失效。
 */
export function extractItemGuidFromUrl(value: string): string | null {
    try {
        const url = new URL(value, 'http://fntv.local');

        for (const key of QUERY_KEYS) {
            const candidate = normalizeCandidate(url.searchParams.get(key));
            if (candidate) return candidate;
        }

        const pathCandidate = extractFromPath(url.pathname);
        if (pathCandidate) return pathCandidate;

        const hash = url.hash.replace(/^#/, '');
        if (hash) {
            const hashUrl = new URL(hash.startsWith('/') ? hash : `/${hash}`, 'http://fntv.local');
            for (const key of QUERY_KEYS) {
                const candidate = normalizeCandidate(hashUrl.searchParams.get(key));
                if (candidate) return candidate;
            }
            return extractFromPath(hashUrl.pathname);
        }
    } catch {
        return extractFromPath(value);
    }

    return null;
}

export function isItemGuid(value: string | null | undefined): value is string {
    const candidate = normalizeCandidate(value);
    return candidate !== null && (GUID_PATTERN.test(candidate) || UUID_PATTERN.test(candidate));
}
