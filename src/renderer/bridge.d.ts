/**
 * preload 桥接 API 的渲染层类型（P1-05）。
 * 注意：仅用于类型提示；实际暴露的白名单由 preload 控制。
 */
export {};

declare global {
    interface ElectronBridgeApi {
        send(channel: string, ...args: unknown[]): void;
        on(channel: string, listener: (event: unknown, data: unknown) => void): void;
        once(channel: string, listener: (event: unknown, data: unknown) => void): void;
        off(channel: string, listener: (event: unknown, data: unknown) => void): void;
        openExternal(url: string): Promise<void>;
    }

    interface RendererLog {
        info(...args: unknown[]): void;
        warn(...args: unknown[]): void;
        error(...args: unknown[]): void;
        debug?(...args: unknown[]): void;
    }

    interface Window {
        electronAPI?: ElectronBridgeApi;
        log?: RendererLog;
        logger?: RendererLog;
    }
}
