/** 媒体库分类页筛选/排序/视图状态与可选项（仅开放真实接口支持的能力） */
export type SortKey = 'added' | 'title' | 'year' | 'recentPlayed';
export type WatchedFilterKey = 'all' | 'watched' | 'unwatched';
export type FavoriteFilterKey = 'all' | 'fav' | 'unfav';
export type ViewMode = 'grid' | 'list';

export const SORT_OPTIONS: ReadonlyArray<{ id: SortKey; label: string }> = [
    { id: 'added', label: '最近添加' },
    { id: 'title', label: '标题' },
    { id: 'year', label: '年份' },
    { id: 'recentPlayed', label: '最近播放' },
];

export const WATCHED_OPTIONS: ReadonlyArray<{ id: WatchedFilterKey; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'watched', label: '已看' },
    { id: 'unwatched', label: '未看' },
];

export const FAVORITE_OPTIONS: ReadonlyArray<{ id: FavoriteFilterKey; label: string }> = [
    { id: 'all', label: '全部' },
    { id: 'fav', label: '已收藏' },
    { id: 'unfav', label: '未收藏' },
];
