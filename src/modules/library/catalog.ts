import type { LibraryStore } from './store';
import type { LibraryItem, Show } from './types';
import { categoryOfSource, isPrivateSource, type SourceCategory } from './sourceCategory';
import { compareCodePoints } from './sort';

export type CatalogQuery = {
    kind?: 'all' | 'movie' | 'episode';
    /** 源内容类型筛选（对齐飞牛影视"内容类型"：电影/剧集/动漫/其他视频） */
    category?: SourceCategory;
    /**
     * 可见性：public（默认）永远排除隐私源；private 仅返回隐私源条目（需主进程解锁态把关）
     */
    visibility?: 'public' | 'private';
    watched?: boolean;
    /** 收藏筛选：true=仅已收藏（电影=条目收藏，剧集=整剧收藏），false=仅未收藏 */
    favorite?: boolean;
    query?: string;
    sort?: 'added' | 'title' | 'year' | 'recentPlayed';
    limit?: number;
    /** 分页偏移（在筛选/排序后的稳定序列上切分） */
    offset?: number;
};

export type SeasonCatalogEntry = {
    type: 'season';
    show: Show;
    season: number;
    /** 该剧总季数（用于 UI 决定是否显示季角标） */
    seasonCount: number;
    episodeCount: number;
    watchedCount: number;
    /** 是否已收藏（按季收藏，挂 '{showId}:{season}'，各季独立） */
    favorite: boolean;
    /** 续播集的播放进度（0-100；与"继续观看"同口径，用于卡片/详情展示"观看中 N%"） */
    progressPct: number;
    posterPath: string | null;
    resumeItemId: string;
    addedAt: number;
    lastPlayedAt: number;
};

export type MovieCatalogEntry = {
    type: 'movie';
    item: LibraryItem;
    /** 是否已看完（与"已看/未看"筛选同一数据源） */
    watched: boolean;
    /** 是否已收藏（电影挂 itemId） */
    favorite: boolean;
    addedAt: number;
    lastPlayedAt: number;
};

export type CatalogEntry = MovieCatalogEntry | SeasonCatalogEntry;

export type CatalogPage = {
    entries: CatalogEntry[];
    /** 当前筛选/可见性下的稳定总数 */
    total: number;
    limit: number | null;
    offset: number;
    hasMore: boolean;
};

function entryKey(entry: CatalogEntry): string {
    if (entry.type === 'movie') {
        return `movie:${entry.item.id}`;
    }
    return `season:${entry.show.id}:${entry.season}`;
}

type EpisodeState = {
    watched: boolean;
    positionTs: number;
    durationTs: number;
    lastPlayedAt: number | null;
};

function compareEpisodes(a: LibraryItem, b: LibraryItem): number {
    return (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0);
}

function entryTitle(entry: CatalogEntry): string {
    if (entry.type === 'movie') {
        return entry.item.title;
    }
    return `${entry.show.title} ${String(entry.season).padStart(2, '0')}`;
}

function entryYear(entry: CatalogEntry): number {
    return (entry.type === 'movie' ? entry.item.year : entry.show.year) ?? 0;
}

function pickResume(episodes: LibraryItem[], states: Map<string, EpisodeState>): LibraryItem {
    let resume: LibraryItem | undefined;
    let bestPlayed = 0;
    for (const episode of episodes) {
        const state = states.get(episode.id);
        if (state && !state.watched && state.positionTs > 0 && (state.lastPlayedAt ?? 0) > bestPlayed) {
            resume = episode;
            bestPlayed = state.lastPlayedAt ?? 0;
        }
    }
    if (!resume) {
        resume = episodes.find((e) => states.get(e.id)?.watched !== true) ?? episodes[0];
    }
    return resume;
}

/**
 * 聚合媒体库目录：电影条目 + 剧集季条目（每季一张卡片，含季专属海报）。
 * 观看筛选语义：未看=该季还有未看的集；已看=该季全部集均已看。
 */
export function buildCatalogPage(store: LibraryStore, query: CatalogQuery = {}): CatalogPage {
    const movieEntries: CatalogEntry[] = [];
    const seasonEntries: CatalogEntry[] = [];
    const needle = (query.query ?? '').trim().toLowerCase();
    const watchStates = new Map(store.listWatchStates().map((state) => [state.itemId, state]));

    const sources = store.listSources();
    const categoryBySource = new Map<string, SourceCategory>();
    const privateSourceIds = new Set<string>();
    for (const source of sources) {
        if (isPrivateSource(source)) {
            privateSourceIds.add(source.id);
        }
        if (query.category !== undefined) {
            categoryBySource.set(source.id, categoryOfSource(source));
        }
    }
    const visibility = query.visibility ?? 'public';
    const favoriteKeys = new Set(store.listFavoriteKeys());
    const matchesVisibility = (sourceId: string | null | undefined): boolean => {
        const isPrivate = typeof sourceId === 'string' && privateSourceIds.has(sourceId);
        return visibility === 'private' ? isPrivate : !isPrivate;
    };
    const matchesCategory = (sourceId: string | null | undefined): boolean =>
        query.category === undefined ||
        (typeof sourceId === 'string' && categoryBySource.get(sourceId) === query.category);

    const episodesByShow = new Map<string, LibraryItem[]>();
    if (query.kind !== 'movie') {
        for (const episode of store.listItems({ kind: 'episode' })) {
            if (!episode.showId) {
                continue;
            }
            const group = episodesByShow.get(episode.showId);
            if (group) {
                group.push(episode);
            } else {
                episodesByShow.set(episode.showId, [episode]);
            }
        }
    }

    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    const limit = query.limit !== undefined ? Math.max(0, Math.floor(query.limit)) : null;

    let movieTotal = 0;
    if (query.kind !== 'episode') {
        const movieSourceIds = sources
            .filter((source) => matchesVisibility(source.id) && matchesCategory(source.id))
            .map((source) => source.id);
        const prefixLimit = limit !== null ? offset + limit : undefined;
        const moviePage = store.queryMovieCatalog({
            sourceIds: movieSourceIds,
            needle: (query.query ?? '').trim(),
            watched: query.watched,
            favorite: query.favorite,
            sort: query.sort,
            limit: prefixLimit,
            offset: 0,
        });
        movieTotal = moviePage.total;
        for (const item of moviePage.items) {
            const state = watchStates.get(item.id);
            movieEntries.push({
                type: 'movie',
                item,
                watched: state?.watched ?? false,
                favorite: favoriteKeys.has(`movie:${item.id}`),
                addedAt: item.addedAt,
                lastPlayedAt: state?.lastPlayedAt ?? 0,
            });
        }
    }

    if (query.kind !== 'movie') {
        for (const show of store.listShows()) {
            if (needle.length > 0 && !show.title.toLowerCase().includes(needle)) {
                continue;
            }
            if (!matchesVisibility(show.sourceId)) {
                continue;
            }
            if (!matchesCategory(show.sourceId)) {
                continue;
            }
            const episodes = (episodesByShow.get(show.id) ?? []).sort(compareEpisodes);
            if (episodes.length === 0) {
                continue;
            }
            const states = new Map<string, EpisodeState>();
            for (const episode of episodes) {
                const state = watchStates.get(episode.id);
                states.set(episode.id, {
                    watched: state?.watched ?? false,
                    positionTs: state?.positionTs ?? 0,
                    durationTs: state?.durationTs ?? 0,
                    lastPlayedAt: state?.lastPlayedAt ?? null,
                });
            }

            const seasonGroups = new Map<number, LibraryItem[]>();
            for (const episode of episodes) {
                const season = episode.season ?? 1;
                const group = seasonGroups.get(season);
                if (group) {
                    group.push(episode);
                } else {
                    seasonGroups.set(season, [episode]);
                }
            }
            const seasonCount = seasonGroups.size;

            for (const [season, seasonEpisodes] of seasonGroups) {
                const watchedCount = seasonEpisodes.filter((e) => states.get(e.id)?.watched === true).length;
                if (query.watched === true && watchedCount !== seasonEpisodes.length) {
                    continue;
                }
                if (query.watched === false && watchedCount === seasonEpisodes.length) {
                    continue;
                }
                const seasonInfo = store.getSeason(show.id, season);
                const posterPath =
                    seasonInfo?.posterPath ??
                    show.posterPath ??
                    seasonEpisodes.map((e) => e.posterPath).find((p): p is string => p !== null) ??
                    null;
                const addedAt = seasonEpisodes.reduce((max, e) => Math.max(max, e.addedAt), 0);
                const lastPlayedAt = seasonEpisodes.reduce(
                    (max, e) => Math.max(max, states.get(e.id)?.lastPlayedAt ?? 0),
                    0
                );
                const resumeEpisode = pickResume(seasonEpisodes, states);
                const resumeState = states.get(resumeEpisode.id);
                const progressPct =
                    resumeState && !resumeState.watched && resumeState.positionTs > 0 && resumeState.durationTs > 0
                        ? Math.min(100, Math.round((resumeState.positionTs / resumeState.durationTs) * 100))
                        : 0;
                seasonEntries.push({
                    type: 'season',
                    show,
                    season,
                    seasonCount,
                    episodeCount: seasonEpisodes.length,
                    watchedCount,
                    favorite: favoriteKeys.has(`season:${show.id}:${season}`),
                    progressPct,
                    posterPath,
                    resumeItemId: resumeEpisode.id,
                    addedAt,
                    lastPlayedAt,
                });
            }
        }
    }

    const seasonVisible =
        query.favorite === undefined
            ? seasonEntries
            : seasonEntries.filter((entry) => entry.favorite === query.favorite);
    const visibleEntries = [...movieEntries, ...seasonVisible];

    const sort = query.sort ?? 'added';
    visibleEntries.sort((a, b) => {
        switch (sort) {
            case 'title':
                return (
                    compareCodePoints(entryTitle(a), entryTitle(b)) || compareCodePoints(entryKey(a), entryKey(b))
                );
            case 'year':
                return (
                    entryYear(b) - entryYear(a) ||
                    compareCodePoints(entryTitle(a), entryTitle(b)) ||
                    compareCodePoints(entryKey(a), entryKey(b))
                );
            case 'recentPlayed':
                return b.lastPlayedAt - a.lastPlayedAt || compareCodePoints(entryKey(a), entryKey(b));
            case 'added':
            default:
                return b.addedAt - a.addedAt || compareCodePoints(entryKey(a), entryKey(b));
        }
    });

    const total = movieTotal + seasonVisible.length;
    const sliced = limit !== null ? visibleEntries.slice(offset, offset + limit) : visibleEntries.slice(offset);
    return {
        entries: sliced,
        total,
        limit,
        offset,
        hasMore: offset + sliced.length < total,
    };
}

/** 兼容旧调用方：仅返回当前页条目 */
export function buildCatalog(store: LibraryStore, query: CatalogQuery = {}): CatalogEntry[] {
    return buildCatalogPage(store, query).entries;
}
