import type { LibraryStore } from './store';
import type { LibraryItem, Show } from './types';
import { categoryOfSource, isPrivateSource, type SourceCategory } from './sourceCategory';

export type CatalogQuery = {
    kind?: 'all' | 'movie' | 'episode';
    /** 源内容类型筛选（对齐飞牛影视"内容类型"：电影/剧集/动漫/其他视频） */
    category?: SourceCategory;
    /**
     * 可见性：public（默认）永远排除隐私源；private 仅返回隐私源条目（需主进程解锁态把关）
     */
    visibility?: 'public' | 'private';
    watched?: boolean;
    query?: string;
    sort?: 'added' | 'title' | 'year' | 'recentPlayed';
    limit?: number;
};

export type SeasonCatalogEntry = {
    type: 'season';
    show: Show;
    season: number;
    /** 该剧总季数（用于 UI 决定是否显示季角标） */
    seasonCount: number;
    episodeCount: number;
    watchedCount: number;
    posterPath: string | null;
    resumeItemId: string;
    addedAt: number;
    lastPlayedAt: number;
};

export type MovieCatalogEntry = {
    type: 'movie';
    item: LibraryItem;
    addedAt: number;
    lastPlayedAt: number;
};

export type CatalogEntry = MovieCatalogEntry | SeasonCatalogEntry;

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
export function buildCatalog(store: LibraryStore, query: CatalogQuery = {}): CatalogEntry[] {
    const entries: CatalogEntry[] = [];
    const needle = (query.query ?? '').trim().toLowerCase();

    const categoryBySource = new Map<string, SourceCategory>();
    const privateSourceIds = new Set<string>();
    for (const source of store.listSources()) {
        if (isPrivateSource(source)) {
            privateSourceIds.add(source.id);
        }
        if (query.category !== undefined) {
            categoryBySource.set(source.id, categoryOfSource(source));
        }
    }
    const visibility = query.visibility ?? 'public';
    const matchesVisibility = (sourceId: string | null | undefined): boolean => {
        const isPrivate = typeof sourceId === 'string' && privateSourceIds.has(sourceId);
        return visibility === 'private' ? isPrivate : !isPrivate;
    };
    const matchesCategory = (sourceId: string | null | undefined): boolean =>
        query.category === undefined ||
        (typeof sourceId === 'string' && categoryBySource.get(sourceId) === query.category);

    if (query.kind !== 'episode') {
        let movies = store.listItems({ kind: 'movie' });
        if (needle.length > 0) {
            movies = movies.filter(
                (m) =>
                    m.title.toLowerCase().includes(needle) ||
                    (m.originalTitle ?? '').toLowerCase().includes(needle)
            );
        }
        if (query.watched !== undefined) {
            movies = movies.filter((m) => (store.getWatchState(m.id)?.watched ?? false) === query.watched);
        }
        movies = movies.filter((m) => matchesVisibility(m.sourceId) && matchesCategory(m.sourceId));
        for (const item of movies) {
            const state = store.getWatchState(item.id);
            entries.push({
                type: 'movie',
                item,
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
            const episodes = store.listItems({ showId: show.id }).sort(compareEpisodes);
            if (episodes.length === 0) {
                continue;
            }
            const states = new Map<string, EpisodeState>();
            for (const episode of episodes) {
                const state = store.getWatchState(episode.id);
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
                entries.push({
                    type: 'season',
                    show,
                    season,
                    seasonCount,
                    episodeCount: seasonEpisodes.length,
                    watchedCount,
                    posterPath,
                    resumeItemId: pickResume(seasonEpisodes, states).id,
                    addedAt,
                    lastPlayedAt,
                });
            }
        }
    }

    const sort = query.sort ?? 'added';
    entries.sort((a, b) => {
        switch (sort) {
            case 'title':
                return entryTitle(a).localeCompare(entryTitle(b), 'zh', { sensitivity: 'base' });
            case 'year':
                return entryYear(b) - entryYear(a) || entryTitle(a).localeCompare(entryTitle(b), 'zh');
            case 'recentPlayed':
                return b.lastPlayedAt - a.lastPlayedAt;
            case 'added':
            default:
                return b.addedAt - a.addedAt;
        }
    });

    return query.limit !== undefined ? entries.slice(0, query.limit) : entries;
}
