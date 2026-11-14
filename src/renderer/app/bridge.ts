/** 渲染层对 preload 桥接的薄封装（P2-07 将归入 services/desktop） */

export function getBridge() {
    return window.electronAPI;
}

export function sendChannel(channel: string, payload?: unknown): boolean {
    const bridge = getBridge();
    if (!bridge) {
        return false;
    }
    bridge.send(channel, payload);
    return true;
}

export function onceReply<T>(channel: string, timeoutMs = 5000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const bridge = getBridge();
        if (!bridge) {
            reject(new Error('BRIDGE_UNAVAILABLE'));
            return;
        }
        const listener = (_event: unknown, data: unknown) => {
            window.clearTimeout(timer);
            resolve(data as T);
        };
        const timer = window.setTimeout(() => {
            bridge.off?.(channel, listener);
            reject(new Error('IPC_TIMEOUT'));
        }, timeoutMs);
        bridge.once(channel, listener);
    });
}
