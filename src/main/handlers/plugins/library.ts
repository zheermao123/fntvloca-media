import { dialog, IpcMainEvent } from 'electron';
import { registerHandler } from '../core/ipcHandler';
import { getMainWindow } from '../../common/mainwin';
import * as log from '../../../modules/logger';
import * as fnConfig from '../../../modules/fn_config/config';
import { getLibraryStore, getLibraryCacheDir } from '../../../modules/library/libraryService';
import { scanLocalFolder } from '../../../modules/library/scanner';
import { scanWebdavFolder } from '../../../modules/library/webdav';
import { encryptSecret, decryptSecret } from '../../../modules/library/credentials';
import { ingestScanResult } from '../../../modules/library/ingest';
import type { IngestSummary } from '../../../modules/library/ingest';
import { LibraryScraper } from '../../../modules/library/scraper';
import { buildCatalog } from '../../../modules/library/catalog';
import { categoryOfSource, guessSourceCategory, normalizeCategory } from '../../../modules/library/sourceCategory';
import { isPrivateSource } from '../../../modules/library/sourceCategory';
import {
    hashPrivacyPassword,
    isPrivacyUnlocked,
    isValidPrivacyPassword,
    PRIVACY_PASSWORD_MIN_LENGTH,
    setPrivacyUnlocked,
    verifyPrivacyPassword,
} from '../../../modules/library/privacy';

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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function privateSourceIds(): Set<string> {
    const store = getLibraryStore();
    return new Set(store.listSources().filter((s) => isPrivateSource(s)).map((s) => s.id));
}

function itemIsPrivate(sourceId: string | null | undefined): boolean {
    return typeof sourceId === 'string' && privateSourceIds().has(sourceId);
}

async function scanSource(sourceId: string): Promise<IngestSummary> {
    const store = getLibraryStore();
    const source = store.getSource(sourceId);
    if (!source) {
        throw new Error(`媒体源不存在: ${sourceId}`);
    }
    if (source.type === 'webdav') {
        const url = source.config.url ?? '';
        if (!url) {
            throw new Error('该 WebDAV 源未配置地址');
        }
        const scan = await scanWebdavFolder({
            baseUrl: url,
            username: source.config.username || undefined,
            password: decryptSecret(source.config.passwordEnc || '') || undefined,
        });
        if (scan.errors.length > 0) {
            log.warn(`[library] webdav scan ${url} errors:`, scan.errors.slice(0, 5));
        }
        return ingestScanResult(store, sourceId, scan);
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

function listSourcesPayload(privateOnly: boolean): { sources: unknown[] } {
    const store = getLibraryStore();
    const sources = store
        .listSources()
        .filter((source) => isPrivateSource(source) === privateOnly)
        .map((source) => {
            const itemCount = store.countItems(source.id);
            return { ...source, itemCount, category: categoryOfSource(source) };
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

    registerHandler('library:add-source', (
        event: IpcMainEvent,
        payload: { type?: string; name?: string; rootPath?: string; url?: string; username?: string; password?: string; category?: string; private?: boolean }
    ) => {
        try {
            const isPrivate = payload?.private === true;
            if (payload?.type === 'webdav') {
                const url = (payload.url ?? '').trim();
                if (!url) {
                    throw new Error('缺少 WebDAV 地址');
                }
                const username = (payload.username ?? '').trim();
                const created = store.addSource({
                    type: 'webdav',
                    name: payload?.name?.trim() || url,
                    config: {
                        url: url.replace(/\/+$/, ''),
                        username,
                        passwordEnc: payload.password ? encryptSecret(payload.password) : '',
                        category: normalizeCategory(payload.category) ?? guessSourceCategory(payload.name?.trim() || url, url),
                        ...(isPrivate ? { private: '1' } : {}),
                    },
                });
                reply(event, 'library:source-added', { source: created });
                return;
            }
            const rootPath = payload?.rootPath ?? '';
            if (!rootPath) {
                throw new Error('缺少扫描目录');
            }
            const created = store.addSource({
                type: 'local',
                name: payload?.name?.trim() || rootPath,
                config: {
                    rootPath,
                    category: normalizeCategory(payload.category) ?? guessSourceCategory(payload.name?.trim() || rootPath, rootPath),
                    ...(isPrivate ? { private: '1' } : {}),
                },
            });
            reply(event, 'library:source-added', { source: created });
        } catch (error) {
            log.error('[library] 添加源失败:', error);
            reply(event, 'library:source-added', { error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:list-sources', (event: IpcMainEvent, payload?: { private?: boolean }) => {
        const wantPrivate = payload?.private === true;
        if (wantPrivate && !isPrivacyUnlocked()) {
            reply(event, 'library:sources-info', { sources: [], locked: true });
            return;
        }
        reply(event, 'library:sources-info', listSourcesPayload(wantPrivate));
    });

    registerHandler('library:privacy-begin', (event: IpcMainEvent) => {
        const hash = fnConfig.getPrivacyPasswordHash();
        reply(event, 'library:privacy-state', {
            hasPassword: typeof hash === 'string' && hash.length > 0,
            unlocked: isPrivacyUnlocked(),
        });
    });

    registerHandler('library:privacy-set-password', (event: IpcMainEvent, payload: { password?: string }) => {
        try {
            if (!isValidPrivacyPassword(payload?.password)) {
                throw new Error(`密码至少 ${PRIVACY_PASSWORD_MIN_LENGTH} 位`);
            }
            fnConfig.setPrivacyPasswordHash(hashPrivacyPassword(payload.password));
            setPrivacyUnlocked(true);
            reply(event, 'library:privacy-result', { success: true, unlocked: true });
        } catch (error) {
            reply(event, 'library:privacy-result', { success: false, error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:privacy-unlock', (event: IpcMainEvent, payload: { password?: string }) => {
        void (async () => {
            try {
                const hash = fnConfig.getPrivacyPasswordHash();
                if (!hash) {
                    throw new Error('尚未设置隐私密码');
                }
                if (!verifyPrivacyPassword(String(payload?.password ?? ''), hash)) {
                    await sleep(1000);
                    throw new Error('密码错误');
                }
                setPrivacyUnlocked(true);
                reply(event, 'library:privacy-result', { success: true, unlocked: true });
            } catch (error) {
                reply(event, 'library:privacy-result', { success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
    });

    registerHandler('library:privacy-lock', (event: IpcMainEvent) => {
        setPrivacyUnlocked(false);
        reply(event, 'library:privacy-result', { success: true, unlocked: false });
    });

    registerHandler('library:privacy-reset', (event: IpcMainEvent) => {
        try {
            fnConfig.setPrivacyPasswordHash(null);
            setPrivacyUnlocked(false);
            reply(event, 'library:privacy-result', { success: true, unlocked: false, reset: true });
        } catch (error) {
            reply(event, 'library:privacy-result', { success: false, error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:set-source-category', (event: IpcMainEvent, payload: { id?: string; category?: string }) => {
        try {
            const id = payload?.id ?? '';
            const source = id ? store.getSource(id) : null;
            if (!source) {
                throw new Error('媒体源不存在');
            }
            const category = normalizeCategory(payload?.category);
            if (!category) {
                throw new Error('无效的内容类型');
            }
            store.updateSource({ ...source, config: { ...source.config, category } });
            reply(event, 'library:source-updated', { success: true });
        } catch (error) {
            log.error('[library] 更新源类型失败:', error);
            reply(event, 'library:source-updated', { success: false, error: error instanceof Error ? error.message : String(error) });
        }
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
            if (itemIsPrivate(item.sourceId) && !isPrivacyUnlocked()) {
                reply(event, 'library:item-info', { error: '需要解锁隐私模式' });
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

    registerHandler('library:catalog', (event: IpcMainEvent, payload: Record<string, unknown> = {}) => {
        try {
            const kind = payload.kind === 'movie' || payload.kind === 'episode' ? payload.kind : 'all';
            const sort = payload.sort;
            const wantsPrivate = payload.private === true;
            if (wantsPrivate && !isPrivacyUnlocked()) {
                reply(event, 'library:catalog-info', { entries: [], locked: true });
                return;
            }
            const entries = buildCatalog(store, {
                kind,
                category: wantsPrivate ? undefined : (normalizeCategory(payload.category) ?? undefined),
                visibility: wantsPrivate ? 'private' : 'public',
                watched: payload.watched === true || payload.watched === false ? payload.watched : undefined,
                query: typeof payload.query === 'string' ? payload.query : undefined,
                sort: sort === 'title' || sort === 'year' || sort === 'recentPlayed' || sort === 'added' ? sort : 'added',
                limit: typeof payload.limit === 'number' ? payload.limit : undefined,
            });
            reply(event, 'library:catalog-info', { entries });
        } catch (error) {
            log.error('[library] 目录查询失败:', error);
            reply(event, 'library:catalog-info', { entries: [] });
        }
    });

    registerHandler('library:show', (event: IpcMainEvent, payload: { id?: string; season?: number }) => {
        try {
            const show = payload?.id ? store.getShow(payload.id) : null;
            if (!show) {
                reply(event, 'library:show-info', { error: '剧集不存在' });
                return;
            }
            if (itemIsPrivate(show.sourceId) && !isPrivacyUnlocked()) {
                reply(event, 'library:show-info', { error: '需要解锁隐私模式' });
                return;
            }
            let episodes = store.listItems({ showId: show.id }).sort(
                (a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0)
            );
            const seasonFilter = typeof payload?.season === 'number' ? payload.season : null;
            if (seasonFilter !== null) {
                episodes = episodes.filter((episode) => (episode.season ?? 1) === seasonFilter);
            }
            const states: Record<string, { watched: boolean; positionTs: number; durationTs: number; lastPlayedAt: number | null }> = {};
            for (const episode of episodes) {
                const state = store.getWatchState(episode.id);
                states[episode.id] = {
                    watched: state?.watched ?? false,
                    positionTs: state?.positionTs ?? 0,
                    durationTs: state?.durationTs ?? 0,
                    lastPlayedAt: state?.lastPlayedAt ?? null,
                };
            }
            reply(event, 'library:show-info', {
                show,
                season: seasonFilter,
                seasonInfo: seasonFilter !== null ? store.getSeason(show.id, seasonFilter) : null,
                episodes,
                states,
            });
        } catch (error) {
            log.error('[library] 剧集组查询失败:', error);
            reply(event, 'library:show-info', { error: error instanceof Error ? error.message : String(error) });
        }
    });

    registerHandler('library:continue', (event: IpcMainEvent, payload?: { private?: boolean }) => {
        const wantPrivate = payload?.private === true;
        if (wantPrivate && !isPrivacyUnlocked()) {
            reply(event, 'library:continue-info', { entries: [] });
            return;
        }
        const privateIds = privateSourceIds();
        const entries = store
            .listContinueWatching(20)
            .filter(({ item }) => privateIds.has(item.sourceId) === wantPrivate);
        reply(event, 'library:continue-info', { entries });
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

    registerHandler('library:search-tmdb', (event: IpcMainEvent, payload: { itemId?: string; query?: string; year?: number | null }) => {
        void (async () => {
            try {
                const settings = fnConfig.getScraperSettings();
                if (!settings.apiKey) {
                    reply(event, 'library:search-results', { error: '请先在设置中填写 TMDB API Key' });
                    return;
                }
                const item = store.getItem(payload?.itemId ?? '');
                const query = (payload?.query ?? '').trim();
                if (!item || query.length === 0) {
                    reply(event, 'library:search-results', { error: '缺少查询条件' });
                    return;
                }
                if (itemIsPrivate(item.sourceId)) {
                    reply(event, 'library:search-results', { error: '隐私内容不参与刮削' });
                    return;
                }
                const scraper = new LibraryScraper({
                    store,
                    cacheDir: getLibraryCacheDir(),
                    config: settings,
                });
                const year = payload?.year ?? item.year ?? undefined;
                const results = item.kind === 'episode'
                    ? await scraper.searchTv(query, year ?? undefined)
                    : await scraper.searchMovie(query, year ?? undefined);
                reply(event, 'library:search-results', {
                    results: results.slice(0, 10).map((r) => ({
                        id: r.id,
                        title: r.title,
                        date: r.date,
                        voteAverage: r.voteAverage,
                        overview: (r.overview ?? '').slice(0, 140),
                    })),
                });
            } catch (error) {
                log.error('[library] TMDB 搜索失败:', error);
                reply(event, 'library:search-results', { error: error instanceof Error ? error.message : String(error) });
            }
        })();
    });

    registerHandler('library:apply-match', (event: IpcMainEvent, payload: { itemId?: string; tmdbId?: number }) => {
        void (async () => {
            try {
                const settings = fnConfig.getScraperSettings();
                if (!settings.apiKey) {
                    reply(event, 'library:match-applied', { success: false, error: '请先在设置中填写 TMDB API Key' });
                    return;
                }
                const item = store.getItem(payload?.itemId ?? '');
                const tmdbId = Number(payload?.tmdbId);
                if (!item || !Number.isFinite(tmdbId)) {
                    reply(event, 'library:match-applied', { success: false, error: '参数无效' });
                    return;
                }
                const scraper = new LibraryScraper({
                    store,
                    cacheDir: getLibraryCacheDir(),
                    config: settings,
                });
                if (item.kind === 'episode') {
                    if (!item.showId) {
                        throw new Error('该剧集未关联剧集组，无法匹配');
                    }
                    await scraper.applyShowMatch(item.showId, tmdbId);
                } else {
                    await scraper.applyMovieMatch(item.id, tmdbId);
                }
                reply(event, 'library:match-applied', { success: true });
            } catch (error) {
                log.error('[library] 手动匹配失败:', error);
                reply(event, 'library:match-applied', { success: false, error: error instanceof Error ? error.message : String(error) });
            }
        })();
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
