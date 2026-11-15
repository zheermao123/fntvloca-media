/** 媒体详情与播放动作适配（复用 library:show / library:item / play-library-item） */
import { invoke, onceReply, sendChannel } from '../desktop/desktopBridge';
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

/** 播放为既有链路（fire-and-forget，无成功/失败回包；不虚构播放状态） */
export function playLibraryItem(itemId: string): boolean {
    return sendChannel('play-library-item', { itemId });
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