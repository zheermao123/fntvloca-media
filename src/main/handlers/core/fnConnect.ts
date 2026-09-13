/**
 * FN Connect 可能保持在 5ddd.com/{fnId}，也可能跳转到 NAS 地址。
 * API base URL 必须保留前一种形式的 FN ID 路径。
 */
export function resolveFnConnectBaseUrl(pageUrl: string, fnConnectUrl: string): string {
    const page = new URL(pageUrl);
    const entry = new URL(fnConnectUrl);
    if (page.hostname === entry.hostname) return fnConnectUrl.replace(/\/$/, '');
    return `${page.protocol}//${page.host}`;
}

export function applyVerifiedOriginToFnConnectBaseUrl(
    fnConnectBaseUrl: string,
    verifiedOrigin: string,
): string {
    const base = new URL(fnConnectBaseUrl);
    const pathname = base.pathname === '/' ? '' : base.pathname.replace(/\/$/, '');
    return `${new URL(verifiedOrigin).origin}${pathname}`;
}
