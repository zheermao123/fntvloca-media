import { mkdirSync } from 'fs';
import path from 'path';
import * as log from '../logger';
import type {
    ItemMetadataPatch,
    LibraryItem,
    ListItemQuery,
    NewItem,
    NewShow,
    NewSource,
    SeasonInfo,
    Show,
    SkipInfo,
    SourceConfig,
    WatchedEntry,
    WatchState,
} from './types';
import { loadSqliteModule } from './sqliteModule';
import { SqliteLibraryStore } from './sqliteStore';
import { JsonLibraryStore } from './jsonStore';

export type ShowMetadataPatch = Partial<
    Pick<Show, 'title' | 'year' | 'overview' | 'posterPath' | 'backdropPath' | 'tmdbId'>
>;

export type LibraryStore = {
    addSource(input: NewSource): SourceConfig;
    updateSource(source: SourceConfig): void;
    getSource(id: string): SourceConfig | null;
    listSources(): SourceConfig[];
    removeSource(id: string): void;

    upsertShow(input: NewShow): { show: Show; created: boolean };
    getShow(id: string): Show | null;
    listShows(sourceId?: string): Show[];
    updateShowMetadata(id: string, patch: ShowMetadataPatch): void;

    upsertSeason(input: {
        showId: string;
        season: number;
        posterPath?: string | null;
        name?: string | null;
        overview?: string | null;
        airDate?: string | null;
    }): void;
    getSeason(showId: string, season: number): SeasonInfo | null;
    listSeasons(showId: string): SeasonInfo[];

    upsertItem(input: NewItem): { item: LibraryItem; created: boolean };
    getItem(id: string): LibraryItem | null;
    getItemByPath(sourceId: string, filePath: string): LibraryItem | null;
    listItems(query?: ListItemQuery): LibraryItem[];
    countItems(sourceId?: string): number;
    updateItemMetadata(id: string, patch: ItemMetadataPatch): void;
    removeItemsExcept(sourceId: string, keepIds: string[]): string[];

    getWatchState(itemId: string): WatchState | null;
    markPlaybackStart(itemId: string): void;
    recordProgress(itemId: string, positionTs: number, durationTs: number): void;
    setWatched(itemId: string, watched: boolean): void;
    listContinueWatching(limit?: number): WatchedEntry[];
    listHistory(limit?: number): WatchedEntry[];

    getSkipInfo(key: string): SkipInfo | null;
    setSkipInfo(key: string, skipStart: number, skipEnd: number): void;
    removeSkipInfo(key: string): void;

    flush(): void;
    close(): void;
}

export function createLibraryStore(dbDir: string): LibraryStore {
    mkdirSync(dbDir, { recursive: true });
    const sqlite = loadSqliteModule();
    if (sqlite) {
        try {
            const db = new sqlite.DatabaseSync(path.join(dbDir, 'library.db'));
            log.i('[library] using sqlite store at', dbDir);
            return new SqliteLibraryStore(db);
        } catch (error) {
            log.w('[library] sqlite store unavailable, falling back to json:', error);
        }
    }
    log.i('[library] using json store at', dbDir);
    return new JsonLibraryStore(path.join(dbDir, 'library.json'));
}

export { SqliteLibraryStore } from './sqliteStore';
export { JsonLibraryStore, createJsonLibraryStore } from './jsonStore';
export { loadSqliteModule } from './sqliteModule';;
