/** 媒体库渲染层 DTO 与 UI 模型（与主进程 DTO 分离，映射集中在 library.mapper） */
import type { LibraryCategory } from '../../app/routes';

export type CatalogQuery = {
    kind?: 'all' | 'movie' | 'episode';
    category?: LibraryCategory;
    watched?: boolean;
    favorite?: boolean;
    query?: string;
    sort?: 'added' | 'title' | 'year' | 'recentPlayed';
    limit?: number;
    private?: boolean;
};

type CatalogItemDto = {
    id: string;
    kind: 'movie' | 'episode';
    title: string;
    year: number | null;
    posterPath: string | null;
    overview: string | null;
    rating: number | null;
    runtime: number | null;
    filePath?: string;
    fileSize?: number;
    resolution: string | null;
};

type CatalogShowDto = {
    id: string;
    title: string;
    year: number | null;
    posterPath: string | null;
    overview: string | null;
};

export type CatalogMovieEntryDto = {
    type: 'movie';
    item: CatalogItemDto;
    watched: boolean;
    favorite: boolean;
    addedAt: number;
    lastPlayedAt: number;
};

export type CatalogSeasonEntryDto = {
    type: 'season';
    show: CatalogShowDto;
    season: number;
    seasonCount: number;
    episodeCount: number;
    watchedCount: number;
    favorite: boolean;
    progressPct: number;
    resumeItemId: string;
    addedAt: number;
    lastPlayedAt: number;
};

export type CatalogEntryDto = CatalogMovieEntryDto | CatalogSeasonEntryDto;

export type MediaCardBadge = 'season' | 'episodes' | 'resolution';

export type MediaCardModel = {
    key: string;
    kind: 'movie' | 'season';
    title: string;
    year: number | null;
    poster: string | null;
    subtitle: string | null;
    badges: string[];
    statusText: string;
    /** 详情路由（季卡携带 ?season=） */
    route: string;
};

export type HomeCategorySummary = {
    category: LibraryCategory;
    count: number;
    /** 是否达到查询上限（600），计数为下限 */
    capped: boolean;
};

export type HomeOverview = {
    categories: HomeCategorySummary[];
    recent: MediaCardModel[];
};
