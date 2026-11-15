/** 媒体源查询与扫描动作适配（library:list-sources / library:scan） */
import { invoke, onceReply, onceReplyCancellable, sendChannel } from '../desktop/desktopBridge';
import type { ScanDoneDto, SourceDto } from '../../pages/sources/sources.mapper';

const SCAN_TIMEOUT_MS = 30 * 60 * 1000;

export async function fetchSources(privateActive: boolean): Promise<{ sources: SourceDto[]; locked: boolean }> {
    const result = await invoke<{ sources?: SourceDto[]; locked?: boolean }>(
        'library:list-sources',
        { private: privateActive },
        'library:sources-info'
    );
    return { sources: result?.sources ?? [], locked: result?.locked === true };
}

/** 触发扫描并等待完成汇总（主进程扫描期间无进度事件，仅完成回包） */
export async function runLibraryScan(sourceId?: string, signal?: AbortSignal): Promise<ScanDoneDto> {
    if (signal?.aborted) {
        throw new Error('IPC_CANCELLED');
    }
    const reply = onceReplyCancellable<ScanDoneDto>('library:scan-done', SCAN_TIMEOUT_MS);
    const onAbort = () => {
        reply.cancel();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
        if (!sendChannel('library:scan', { sourceId })) {
            throw new Error('BRIDGE_UNAVAILABLE');
        }
        return await reply.promise;
    } finally {
        signal?.removeEventListener('abort', onAbort);
    }
}

export type SourceTestResultDto = {
    reachable: boolean;
    latencyMs: number;
    reason?: string;
    message?: string;
};

export async function testSource(sourceId: string): Promise<SourceTestResultDto> {
    const requestId = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const reply = onceReply<SourceTestResultDto & { requestId?: string; error?: string }>(
        'library:test-source-result',
        20000
    );
    if (!sendChannel('library:test-source', { sourceId, requestId })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (result?.error) {
        throw new Error(result.error);
    }
    return result ?? { reachable: false, latencyMs: 0, reason: 'unknown' };
}

export async function updateSource(patch: {
    id: string;
    name?: string;
    rootPath?: string;
    url?: string;
    username?: string;
    password?: string | null;
    category?: string;
}): Promise<{ success: boolean; error?: string }> {
    const reply = onceReply<{ success?: boolean; error?: string }>('library:source-updated', 20000);
    if (!sendChannel('library:update-source', patch)) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    return { success: result?.success === true, error: result?.error };
}