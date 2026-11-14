/** 刮削任务适配（library:scrape / scrape-status / scrape-started / 进度 / done） */
import { getBridge, invoke, onceReply, sendChannel } from '../desktop/desktopBridge';
import type { ScrapeProgressDto, ScrapeSummaryDto } from '../../pages/tasks/tasks.mapper';

export type ScrapeStatusResult = {
    running: boolean;
    lastSummary: ScrapeSummaryDto | null;
};

const START_TIMEOUT_MS = 8000;
const DONE_TIMEOUT_MS = 60 * 60 * 1000;

export async function fetchScrapeStatus(): Promise<ScrapeStatusResult> {
    const result = await invoke<ScrapeStatusResult>('library:scrape-status', undefined, 'library:scrape-status-info');
    return { running: result?.running === true, lastSummary: result?.lastSummary ?? null };
}

export function onScrapeProgress(listener: (progress: ScrapeProgressDto) => void): () => void {
    const bridge = getBridge();
    if (!bridge) {
        return () => undefined;
    }
    const wrapped = (_event: unknown, data: unknown) => listener(data as ScrapeProgressDto);
    bridge.on('library-scrape-progress', wrapped);
    return () => bridge.off?.('library-scrape-progress', wrapped);
}

/** 返回 started；未启动时含主进程错误（如缺少 TMDB API Key） */
export async function startScrape(): Promise<{ started: boolean; error?: string }> {
    const wait = onceReply<{ started?: boolean; error?: string }>('library:scrape-started', START_TIMEOUT_MS);
    if (!sendChannel('library:scrape', { force: false })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await wait;
    return { started: result?.started === true, error: result?.error };
}

export function waitScrapeDone(): Promise<{ summary?: ScrapeSummaryDto; error?: string }> {
    return onceReply('library-scrape-done', DONE_TIMEOUT_MS);
}
