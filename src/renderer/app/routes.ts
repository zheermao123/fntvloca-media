/** UI 2.0 路由常量与分类映射（HashRouter；category=other → /library/others） */
export type LibraryCategory = 'movie' | 'tv' | 'anime' | 'other';

export const CATEGORY_META: Record<LibraryCategory, { label: string; segment: string }> = {
    movie: { label: '电影', segment: 'movies' },
    tv: { label: '剧集', segment: 'tv' },
    anime: { label: '动漫', segment: 'anime' },
    other: { label: '其他视频', segment: 'others' },
};

export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = ['movie', 'tv', 'anime', 'other'];

export const ROUTES = {
    home: '/home',
    library: (category: LibraryCategory) => `/library/${CATEGORY_META[category].segment}`,
    media: (id: string) => `/media/${encodeURIComponent(id)}`,
    sources: '/sources',
    tasks: '/tasks',
} as const;

export function resolveCategoryFromSegment(segment: string | undefined): LibraryCategory | null {
    if (!segment) {
        return null;
    }
    const found = LIBRARY_CATEGORIES.find((category) => CATEGORY_META[category].segment === segment);
    return found ?? null;
}
