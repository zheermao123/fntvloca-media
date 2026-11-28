/** 媒体详情与播放动作适配（复用 library:show / library:item / play-library-item） */
import { getBridge, invoke, onceReply, sendChannel } from '../desktop/desktopBridge';
import type { DetailItemDto, DetailShowDto, DetailStateDto } from '../../pages/detail/detail.mapper';

export type ShowInfoResult = {
    show: DetailShowDto;
    season: number | null;
    seasonInfo: { posterPath: string | null; name: string | null } | null;
    favorite: boolean;
    episodes: DetailItemDto[];
    states: Record<string, DetailStateDto>;
};

export type ItemInfoResult = {
    item: DetailItemDto;
    show: DetailShowDto | null;
    watchState: DetailStateDto | null;
    favorite: boolean;
    episodes: DetailItemDto[];
    versions: DetailItemDto[];
};

export async function fetchShowInfo(showId: string, season: number): Promise<ShowInfoResult> {
    const result = await invoke<ShowInfoResult & { error?: string }>(
        'library:show',
        { id: showId, season },
        'library:show-info'
    );
    if (!result || result.error || !result.show) {
        throw new Error(result?.error || '剧集不存在');
    }
    return result;
}

export async function fetchItemInfo(itemId: string): Promise<ItemInfoResult> {
    const result = await invoke<ItemInfoResult & { error?: string }>(
        'library:item',
        { id: itemId },
        'library:item-info'
    );
    if (!result || result.error || !result.item) {
        throw new Error(result?.error || '条目不存在');
    }
    return result;
}

export type ScrapeSummary = {
    scraped: number;
    failed: number;
    skipped: number;
    firstError?: string;
};

export async function scrapeItem(itemId: string): Promise<ScrapeSummary> {
    const reply = onceReply<{ summary?: ScrapeSummary; error?: string }>('library-scrape-done', 120000);
    if (!sendChannel('library:scrape-item', { id: itemId })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (result?.error) {
        throw new Error(result.error);
    }
    const summary = result?.summary;
    if (!summary) {
        throw new Error('刮削未返回结果');
    }
    if (summary.scraped === 0 && summary.failed > 0) {
        throw new Error(summary.firstError || '刮削失败');
    }
    return summary;
}

export type TmdbSearchResult = {
    id: number;
    title: string;
    date: string | null;
    voteAverage: number | null;
    overview: string;
};

export async function searchTmdb(itemId: string, query: string, year?: number | null): Promise<TmdbSearchResult[]> {
    const reply = onceReply<{ results?: TmdbSearchResult[]; error?: string }>('library:search-results', 30000);
    if (!sendChannel('library:search-tmdb', { itemId, query, year })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (result?.error) {
        throw new Error(result.error);
    }
    return result?.results ?? [];
}

export async function applyMatch(itemId: string, tmdbId: number): Promise<void> {
    const reply = onceReply<{ success?: boolean; error?: string }>('library:match-applied', 120000);
    if (!sendChannel('library:apply-match', { itemId, tmdbId })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result?.success) {
        throw new Error(result?.error || '应用匹配失败');
    }
}

export type PlaybackResult = {
    itemId: string;
    ok: boolean;
    error?: string;
};

/** 播放为触发式链路；启动成功/失败通过事件回传（主进程统一校验） */
export function playLibraryItem(itemId: string): boolean {
    return sendChannel('play-library-item', { itemId });
}

export function onPlaybackResult(listener: (result: PlaybackResult) => void): () => void {
    const bridge = getBridge();
    if (!bridge) {
        return () => undefined;
    }
    const wrapped = (_event: unknown, data: unknown) => {
        const result = data as PlaybackResult | undefined;
        if (result && typeof result.itemId === 'string' && typeof result.ok === 'boolean') {
            listener(result);
        }
    };
    bridge.on('play-library-item-result', wrapped);
    return () => bridge.off?.('play-library-item-result', wrapped);
}

export async function setWatched(itemId: string, watched: boolean): Promise<void> {
    const reply = onceReply<{ success?: boolean; error?: string }>('library:watched-set', 8000);
    if (!sendChannel('library:set-watched', { id: itemId, watched })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result?.success) {
        throw new Error(result?.error || '更新观看状态失败');
    }
}

export async function setFavorite(
    type: 'movie' | 'season',
    id: string,
    favorite: boolean,
    season?: number
): Promise<void> {
    const reply = onceReply<{ success?: boolean; error?: string }>('library:favorite-set', 8000);
    if (!sendChannel('library:set-favorite', { type, id, favorite, season })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result?.success) {
        throw new Error(result?.error || '更新收藏失败');
    }
}