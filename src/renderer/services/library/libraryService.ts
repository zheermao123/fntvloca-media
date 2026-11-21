/** 媒体库查询适配（复用既有 library:catalog / library:show / library:item） */
import { invoke, onceReplyMatching, sendChannel } from '../desktop/desktopBridge';
import { LIBRARY_CATEGORIES } from '../../app/routes';
import { mapCatalogEntries, mapHistoryEntries, summarizeCategory } from './library.mapper';
import type {
    CatalogEntryDto,
    CatalogPage,
    CatalogQuery,
    ContinueEntryDto,
    HistoryItemDto,
    HomeOverview,
} from './library.types';

const RECENT_LIMIT = 12;
let catalogRequestSeq = 0;

export async function fetchContinueWatching(privateActive: boolean, limit?: number): Promise<ContinueEntryDto[]> {
    const result = await invoke<{ entries?: ContinueEntryDto[]; error?: string }>(
        'library:continue',
        { private: privateActive, limit },
        'library:continue-info'
    );
    if (!result || result.error) {
        throw new Error(result?.error || '继续观看查询失败');
    }
    return result.entries ?? [];
}

export async function fetchHistory(privateActive: boolean, limit = RECENT_LIMIT): Promise<HistoryItemDto[]> {
    const result = await invoke<{ entries?: HistoryItemDto[]; error?: string }>(
        'library:history',
        { private: privateActive, limit },
        'library:history-info'
    );
    if (!result || result.error) {
        throw new Error(result?.error || '播放历史查询失败');
    }
    return result.entries ?? [];
}

export async function queryCatalogPage(params: CatalogQuery): Promise<CatalogPage> {
    const requestId = `catalog-${Date.now()}-${++catalogRequestSeq}`;
    const reply = onceReplyMatching<Partial<CatalogPage> & { requestId?: string; error?: string }>(
        'library:catalog-info',
        (data) => data?.requestId === requestId,
        8000
    );
    if (!sendChannel('library:catalog', { ...params, requestId })) {
        reply.catch(() => undefined);
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result || result.error) {
        throw new Error(result?.error || '目录查询失败');
    }
    const entries = result.entries ?? [];
    const total = typeof result.total === 'number' ? result.total : entries.length;
    const offset = typeof result.offset === 'number' ? result.offset : params.offset ?? 0;
    const limit = result.limit ?? params.limit ?? null;
    const hasMore = typeof result.hasMore === 'boolean' ? result.hasMore : offset + entries.length < total;
    return { entries, total, limit, offset, hasMore };
}

export async function queryCatalog(params: CatalogQuery): Promise<CatalogEntryDto[]> {
    return (await queryCatalogPage(params)).entries;
}

export async function fetchHomeOverview(): Promise<HomeOverview> {
    const perCategory = await Promise.all(
        LIBRARY_CATEGORIES.map(async (category) => {
            const page = await queryCatalogPage({ category, limit: 1 });
            return { category, total: page.total };
        })
    );
    const categories = perCategory.map(({ category, total }) => summarizeCategory(category, total));
    const [recent, history] = await Promise.all([
        queryCatalogPage({ sort: 'added', limit: RECENT_LIMIT }),
        fetchHistory(false, RECENT_LIMIT),
    ]);
    return {
        categories,
        recent: mapCatalogEntries(recent.entries),
        recentPlayed: mapHistoryEntries(history),
    };
}
