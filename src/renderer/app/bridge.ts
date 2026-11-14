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

export type CancellableReply<T> = {
    promise: Promise<T>;
    cancel: () => void;
};

/** 可取消的一次性回复监听（用于未挂载/离开页面时释放长等待监听） */
export function onceReplyCancellable<T>(channel: string, timeoutMs = 5000): CancellableReply<T> {
    const bridge = getBridge();
    if (!bridge) {
        const promise = Promise.reject<T>(new Error('BRIDGE_UNAVAILABLE'));
        promise.catch(() => undefined);
        return { promise, cancel: () => undefined };
    }
    let settled = false;
    let timer = 0;
    let resolveFn!: (value: T) => void;
    let rejectFn!: (error: Error) => void;
    const listener = (_event: unknown, data: unknown) => {
        if (settled) {
            return;
        }
        settled = true;
        window.clearTimeout(timer);
        resolveFn(data as T);
    };
    const promise = new Promise<T>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
        timer = window.setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            bridge.off?.(channel, listener);
            reject(new Error('IPC_TIMEOUT'));
        }, timeoutMs);
        bridge.once(channel, listener);
    });
    const cancel = () => {
        if (settled) {
            return;
        }
        settled = true;
        window.clearTimeout(timer);
        bridge.off?.(channel, listener);
        rejectFn(new Error('IPC_CANCELLED'));
    };
    return { promise, cancel };
}

export function onceReply<T>(channel: string, timeoutMs = 5000): Promise<T> {
    return onceReplyCancellable<T>(channel, timeoutMs).promise;
}
