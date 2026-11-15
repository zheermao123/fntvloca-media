/** 媒体详情与播放动作适配（复用 library:show / library:item / play-library-item） */
import { invoke, sendChannel } from '../desktop/desktopBridge';
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
