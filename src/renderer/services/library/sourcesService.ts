/** 媒体源查询与扫描动作适配（library:list-sources / library:scan） */
import { invoke, onceReply, sendChannel } from '../desktop/desktopBridge';
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
export async function runLibraryScan(sourceId?: string): Promise<ScanDoneDto> {
    const wait = onceReply<ScanDoneDto>('library:scan-done', SCAN_TIMEOUT_MS);
    if (!sendChannel('library:scan', { sourceId })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    return wait;
}
