import { dialog, IpcMainEvent } from 'electron';
import { registerHandler } from '../core/ipcHandler';
import { getMainWindow } from '../../common/mainwin';
import * as log from '../../../modules/logger';
import * as fnConfig from '../../../modules/fn_config/config';
import { getLibraryStore, getLibraryCacheDir } from '../../../modules/library/libraryService';
import { scanLocalFolder } from '../../../modules/library/scanner';
import { ingestScanResult } from '../../../modules/library/ingest';
import type { IngestSummary } from '../../../modules/library/ingest';
import { LibraryScraper } from '../../../modules/library/scraper';

/**
 * 媒体库数据与刮削插件
 * 负责源管理、扫描、条目查询与 TMDB 刮削的 IPC 接口；播放走 play-library-item（media.ts）。
 */

let scanning = false;
let scraping = false;
let lastScrapeSummary: { scraped: number; failed: number; skipped: number } | null = null;

function reply(event: IpcMainEvent, channel: string, payload: unknown): void {
    event.sender.send(channel, payload);
}

async function scanSource(sourceId: string): Promise<IngestSummary> {
    const store = getLibraryStore();
    const source = store.getSource(sourceId);
    if (!source) {
        throw new Error(`媒体源不存在: ${sourceId}`);
    }
    if (source.type !== 'local') {
        throw new Error(`暂不支持扫描该源类型: ${source.type}`);
    }
    const rootPath = source.config.rootPath;
    if (!rootPath) {
        throw new Error('该源未配置扫描目录');
    }
    const scan = await scanLocalFolder({ rootPath });
    if (scan.errors.length > 0) {
        log.warn(`[library] scan ${rootPath} errors:`, scan.errors.slice(0, 5));
    }
    return ingestScanResult(store, sourceId, scan);
}

function listSourcesPayload(): { sources: unknown[] } {
    const store = getLibraryStore();
    const sources = store.listSources().map((source) => {
        const itemCount = store.countItems(source.id);
        return { ...source, itemCount };
    });
    return { sources };
}

async function runScan(event: IpcMainEvent, sourceId?: string): Promise<void> {
    if (scanning) {
        reply(event, 'library:scan-done', { error: '已有扫描任务在进行中' });
        return;
    }
    scanning = true;
    try {
        const store = getLibraryStore();
        const targets = sourceId
            ? [sourceId]
            : store.listSources().filter((s) => s.type === 'local').map((s) => s.id);
        const totals = { added: 0, updated: 0, removed: 0, skipped: 0 };
        for (const id of targets) {
            try {
                const summary = await scanSource(id);
                totals.added += summary.added;
                totals.updated += summary.updated;
                totals.removed += summary.removed;
                totals.skipped += summary.skipped;
            } catch (error) {
                log.error('[library] 扫描源失败:', id, error);
            }
        }
        reply(event, 'library:scan-done', totals);
    } catch (error) {
        log.error('[library] 扫描失败:', error);
        reply(event, 'library:scan-done', { error: error instanceof Error ? error.message : String(error) });
    } finally {
        scanning = false;
    }
}

function init(): void {
    const store = getLibraryStore();

    registerHandler('library:pick-folder', (event: IpcMainEvent) => {
        dialog.showOpenDialog(getMainWindow(), { properties: ['openDirectory'] })
            .then((result) => {
                reply(event, 'library:pick-folder-result', { path: result.canceled ? null : result.filePaths[0] ?? null });
            })
            .catch((error) => {
                log.error('[library] 选择目录失败:', error);
                reply(event, 'library:pick-folder-result', { path: null, error: String(error) });
            });
    });

    registerHandler('library:add-source', (event: IpcMainEvent, payload: { name?: string; rootPath?: string }) => {
        try {
            const rootPath = payload?.rootPath ?? '';
            if (!rootPath) {
                throw new Error('缺少扫描目录');
            }
            const created = store.addSource({
                type: 'local',
                name: payload?.name?.trim() || rootPath,
                config: { rootPath },
            });
            reply(event, 'library:source-added', { source: created });
        } catch (error) {
            log.error('[library] 添加源失败:', error);
            reply(event, 'library:source-added', { error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:list-sources', (event: IpcMainEvent) => {
        reply(event, 'library:sources-info', listSourcesPayload());
    });

    registerHandler('library:remove-source', (event: IpcMainEvent, payload: { id?: string }) => {
        try {
            const id = payload?.id ?? '';
            if (!id) {
                throw new Error('缺少源 ID');
            }
            store.removeSource(id);
            reply(event, 'library:source-removed', { success: true });
        } catch (error) {
            reply(event, 'library:source-removed', { success: false, error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:scan', (event: IpcMainEvent, payload: { sourceId?: string }) => {
        void runScan(event, payload?.sourceId);
    });

    registerHandler('library:items', (event: IpcMainEvent, payload: Record<string, unknown> = {}) => {
        try {
            const query: Parameters<typeof store.listItems>[0] = {};
            if (payload.kind === 'movie' || payload.kind === 'episode') query.kind = payload.kind;
            if (typeof payload.sourceId === 'string' && payload.sourceId) query.sourceId = payload.sourceId;
            if (typeof payload.query === 'string' && payload.query.trim().length > 0) query.query = payload.query.trim();
            if (payload.watched === true || payload.watched === false) query.watched = payload.watched;
            const sort = payload.sort;
            if (sort === 'title' || sort === 'year' || sort === 'recentPlayed' || sort === 'added') query.sort = sort;
            if (typeof payload.limit === 'number') query.limit = payload.limit;
            if (typeof payload.offset === 'number') query.offset = payload.offset;
            reply(event, 'library:items-info', { items: store.listItems(query) });
        } catch (error) {
            log.error('[library] 查询条目失败:', error);
            reply(event, 'library:items-info', { items: [] });
        }
    });

    registerHandler('library:item', (event: IpcMainEvent, payload: { id?: string }) => {
        try {
            const id = payload?.id ?? '';
            const item = store.getItem(id);
            if (!item) {
                reply(event, 'library:item-info', { error: '条目不存在' });
                return;
            }
            const show = item.showId ? store.getShow(item.showId) : null;
            const siblings = item.showId
                ? store.listItems({ showId: item.showId, sort: 'title' })
                : [];
            reply(event, 'library:item-info', {
                item,
                show,
                watchState: store.getWatchState(item.id),
                episodes: item.kind === 'episode' ? siblings : [],
                versions: item.kind === 'movie' ? siblings : [],
            });
        } catch (error) {
            reply(event, 'library:item-info', { error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:continue', (event: IpcMainEvent) => {
        reply(event, 'library:continue-info', { entries: store.listContinueWatching(20) });
    });

    registerHandler('library:set-watched', (event: IpcMainEvent, payload: { id?: string; watched?: boolean }) => {
        try {
            const id = payload?.id ?? '';
            store.setWatched(id, payload?.watched !== false);
            reply(event, 'library:watched-set', { success: true });
        } catch (error) {
            reply(event, 'library:watched-set', { success: false, error: String(error) });
        }
    });

    registerHandler('library:scrape', (event: IpcMainEvent) => {
        if (scraping) {
            reply(event, 'library:scrape-started', { started: false, error: '刮削任务进行中' });
            return;
        }
        const settings = fnConfig.getScraperSettings();
        if (!settings.apiKey) {
            reply(event, 'library:scrape-started', { started: false, error: '请先在设置中填写 TMDB API Key' });
            return;
        }
        scraping = true;
        reply(event, 'library:scrape-started', { started: true });
        const scraper = new LibraryScraper({
            store,
            cacheDir: getLibraryCacheDir(),
            config: settings,
        });
        scraper.scrapeLibrary({
            onProgress: (progress) => {
                reply(event, 'library-scrape-progress', progress);
            },
        })
            .then((summary) => {
                lastScrapeSummary = summary;
                reply(event, 'library-scrape-done', { summary });
            })
            .catch((error) => {
                log.error('[library] 刮削失败:', error);
                reply(event, 'library-scrape-done', { error: error instanceof Error ? error.message : String(error) });
            })
            .finally(() => {
                scraping = false;
            });
    });

    registerHandler('library:scrape-status', (event: IpcMainEvent) => {
        reply(event, 'library:scrape-status-info', { running: scraping, lastSummary: lastScrapeSummary });
    });

    registerHandler('library:scrape-item', (event: IpcMainEvent, payload: { id?: string }) => {
        const settings = fnConfig.getScraperSettings();
        if (!settings.apiKey) {
            reply(event, 'library-scrape-done', { error: '请先在设置中填写 TMDB API Key' });
            return;
        }
        const scraper = new LibraryScraper({
            store,
            cacheDir: getLibraryCacheDir(),
            config: settings,
        });
        scraper.scrapeItem(payload?.id ?? '')
            .then((summary) => {
                lastScrapeSummary = summary;
                reply(event, 'library-scrape-done', { summary });
            })
            .catch((error) => {
                log.error('[library] 单条刮削失败:', error);
                reply(event, 'library-scrape-done', { error: error instanceof Error ? error.message : String(error) });
            });
    });

    registerHandler('library:settings-get', (event: IpcMainEvent) => {
        reply(event, 'library:settings-info', { settings: fnConfig.getScraperSettings() });
    });

    registerHandler('library:settings-set', (event: IpcMainEvent, payload: fnConfig.SetScraperSettingsParams = {}) => {
        try {
            fnConfig.setScraperSettings(payload ?? {});
            reply(event, 'library:settings-set', { success: true });
        } catch (error) {
            log.error('[library] 保存刮削设置失败:', error);
            reply(event, 'library:settings-set', { success: false, error: error instanceof Error ? error.message : String(error) });
        }
    });

    log.info('[library] 媒体库插件已初始化');
}

export {
    init
};
