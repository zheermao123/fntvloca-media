/** 渲染层统一访问 preload 桥接（P2-07 归口；此处为服务层唯一入口） */
import { getBridge, onceReply, sendChannel } from '../../app/bridge';

export { getBridge, onceReply, sendChannel };

/** 发送请求并等待对应回复通道（FIFO 配对；主进程 catalog 等同步 handler 响应有序） */
export async function invoke<T>(
    channel: string,
    payload: unknown,
    replyChannel: string,
    timeoutMs = 8000
): Promise<T> {
    const wait = onceReply<T>(replyChannel, timeoutMs);
    if (!sendChannel(channel, payload)) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    return wait;
}
