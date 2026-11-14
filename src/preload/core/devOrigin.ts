/**
 * preload 桥接的开发源白名单（P1-05）。
 * 仅允许：开发启动器显式指定的 loopback Vite origin（http://127.0.0.1|localhost:5273）。
 * 任何 https、局域网、远程页面、错误端口或非 react 模式一律拒绝。
 */
export const UI2_DEV_BRIDGE_PORT = 5273;

export function isDevBridgeOrigin(pageUrl: string, envShell: string | undefined): boolean {
    if ((envShell ?? '').trim().toLowerCase() !== 'react') {
        return false;
    }
    if (!pageUrl) {
        return false;
    }
    try {
        const url = new URL(pageUrl);
        if (url.protocol !== 'http:') {
            return false;
        }
        const hostname = url.hostname.toLowerCase();
        if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
            return false;
        }
        return url.port === String(UI2_DEV_BRIDGE_PORT);
    } catch {
        return false;
    }
}
