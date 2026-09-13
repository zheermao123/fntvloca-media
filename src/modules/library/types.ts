export type SourceType = 'local' | 'webdav' | 'strm' | 'fnos';

export type ItemKind = 'movie' | 'episode';

export type MetadataSource = 'tmdb' | 'nfo' | 'filename';

export type SourceConfig = {
    id: string;
    type: SourceType;
    name: string;
    config: Record<string, string>;
    createdAt: number;
    lastScanAt: number | null;
};

export type Show = {
    id: string;
    sourceId: string;
    groupKey: string;
    title: string;
    sortTitle: string | null;
    year: number | null;
    overview: string | null;
    posterPath: string | null;
    backdropPath: string | null;
    tmdbId: string | null;
};

export type LibraryItem = {
    id: string;
    sourceId: string;
    kind: ItemKind;
    showId: string | null;
    title: string;
    originalTitle: string | null;
    year: number | null;
    season: number | null;
    episode: number | null;
    episodeTitle: string | null;
    filePath: string;
    fileSize: number;
    mtime: number;
    resolution: string | null;
    overview: string | null;
    rating: number | null;
    runtime: number | null;
    posterPath: string | null;
    backdropPath: string | null;
    tmdbId: string | null;
    metadataSource: MetadataSource;
    addedAt: number;
};

export type WatchState = {
    itemId: string;
    watched: boolean;
    positionTs: number;
    durationTs: number;
    lastPlayedAt: number | null;
    playCount: number;
};

export type SkipInfo = {
    key: string;
    skipStart: number;
    skipEnd: number;
};

export type ListItemSort = 'added' | 'title' | 'year' | 'recentPlayed';

export type ListItemQuery = {
    kind?: ItemKind;
    sourceId?: string;
    showId?: string;
    watched?: boolean;
    query?: string;
    sort?: ListItemSort;
    limit?: number;
    offset?: number;
};

export type NewSource = {
    type: SourceType;
    name: string;
    config?: Record<string, string>;
};

export type NewShow = {
    sourceId: string;
    groupKey: string;
    title: string;
    sortTitle?: string | null;
    year?: number | null;
};

export type NewItem = {
    sourceId: string;
    kind: ItemKind;
    showId?: string | null;
    title: string;
    originalTitle?: string | null;
    year?: number | null;
    season?: number | null;
    episode?: number | null;
    episodeTitle?: string | null;
    filePath: string;
    fileSize?: number;
    mtime?: number;
    resolution?: string | null;
};

export type ItemMetadataPatch = {
    title?: string;
    episodeTitle?: string | null;
    overview?: string | null;
    rating?: number | null;
    runtime?: number | null;
    posterPath?: string | null;
    backdropPath?: string | null;
    tmdbId?: string | null;
    metadataSource?: MetadataSource;
};

export type WatchedEntry = {
    item: LibraryItem;
    state: WatchState;
};

export const AUTO_WATCH_THRESHOLD = 0.95;
