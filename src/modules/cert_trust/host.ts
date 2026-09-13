/** 将 HTTP(S) 与 WebSocket URL 统一成证书信任键 hostname:port。 */
export function normalizeCertificateHost(value: string): string {
    try {
        const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
        const url = new URL(hasScheme ? value : `https://${value}`);
        const secure = url.protocol === 'https:' || url.protocol === 'wss:';
        const port = url.port || (secure ? '443' : '80');
        return `${url.hostname}:${port}`;
    } catch {
        return value;
    }
}
