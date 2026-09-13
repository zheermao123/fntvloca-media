const accessGrants = new Map<string, string>();

function normalizeOrigin(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.origin;
    } catch {
        return null;
    }
}

function cookieParts(values: Array<string | undefined>): string[] {
    const result: string[] = [];
    const names = new Set<string>();

    for (const value of values) {
        for (const rawPart of (value || '').split(';')) {
            const part = rawPart.trim();
            const separator = part.indexOf('=');
            if (separator <= 0) continue;

            const name = part.slice(0, separator).trim();
            const normalizedName = name.toLowerCase();
            if (!name || normalizedName === 'mode' || names.has(normalizedName)) continue;
            names.add(normalizedName);
            result.push(`${name}=${part.slice(separator + 1).trim()}`);
        }
    }

    result.push('mode=relay');
    return result;
}

export function composeCookieHeader(...values: Array<string | undefined>): string {
    return cookieParts(values).join('; ');
}

export function setAccessGrant(origin: string, cookie: string): void {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) throw new Error('无效的访问码会话地址');

    if (cookie) {
        accessGrants.set(normalizedOrigin, cookie);
    } else {
        accessGrants.delete(normalizedOrigin);
    }
}

export function clearAccessGrants(): void {
    accessGrants.clear();
}

export function getAccessCookieHeader(origin: string): string {
    const normalizedOrigin = normalizeOrigin(origin);
    return normalizedOrigin ? accessGrants.get(normalizedOrigin) || '' : '';
}
