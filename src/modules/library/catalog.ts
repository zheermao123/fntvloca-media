import type { LibraryStore } from './store';
import type { LibraryItem, Show } from './types';

export type CatalogQuery = {
    kind?: 'all' | 'movie' | 'episode';
    watched?: boolean;
    query?: string;
    sort?: 'added' | 'title' | 'year' | 'recentPlayed';
    limit?: number;
};

export type ShowCatalogEntry = {
    type: 'show';
    show: Show;
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

export type CatalogEntry = MovieCatalogEntry | ShowCatalogEntry;

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
    return entry.type === 'movie' ? entry.item.title : entry.show.title;
}

function entryYear(entry: CatalogEntry): number {
    return (entry.type === 'movie' ? entry.item.year : entry.show.year) ?? 0;
}

/**
 * 聚合媒体库目录：电影条目 + 剧集组（含集数/已看数/续播指针）。
 * 观看筛选语义（方案A）：未看=还有未看的集；已看=全部集均已看。
 */
export function buildCatalog(store: LibraryStore, query: CatalogQuery = {}): CatalogEntry[] {
    const entries: CatalogEntry[] = [];
    const needle = (query.query ?? '').trim().toLowerCase();

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
            const watchedCount = episodes.filter((e) => states.get(e.id)?.watched === true).length;
            if (query.watched === true && watchedCount !== episodes.length) {
                continue;
            }
            if (query.watched === false && watchedCount === episodes.length) {
                continue;
            }

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

            const posterPath =
                show.posterPath ?? episodes.map((e) => e.posterPath).find((p): p is string => p !== null) ?? null;
            const addedAt = episodes.reduce((max, e) => Math.max(max, e.addedAt), 0);
            const lastPlayedAt = episodes.reduce(
                (max, e) => Math.max(max, states.get(e.id)?.lastPlayedAt ?? 0),
                0
            );

            entries.push({
                type: 'show',
                show,
                episodeCount: episodes.length,
                watchedCount,
                posterPath,
                resumeItemId: resume.id,
                addedAt,
                lastPlayedAt,
            });
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
