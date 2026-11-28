/** 媒体库条目 → 列表行模型（纯函数，可单测） */
import { mapCatalogEntries } from '../../services/library/library.mapper';
import type { CatalogEntryDto } from '../../services/library/library.types';

export type MediaRowModel = {
    key: string;
    title: string;
    meta: string[];
    statusText: string;
    poster: string | null;
    route: string;
};

export function mapLibraryRows(entries: readonly CatalogEntryDto[]): MediaRowModel[] {
    return mapCatalogEntries(entries).map((card) => ({
        key: card.key,
        title: card.title,
        meta: [
            ...(card.subtitle ? [card.subtitle] : []),
            ...card.badges,
            ...(card.year ? [String(card.year)] : []),
        ],
        statusText: card.statusText,
        poster: card.poster,
        route: card.route,
    }));
}
