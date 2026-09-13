import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
    ItemMetadataPatch,
    LibraryItem,
    ListItemQuery,
    NewItem,
    NewShow,
    Show,
    SkipInfo,
    SourceConfig,
    WatchedEntry,
    WatchState,
} from './types';
import { AUTO_WATCH_THRESHOLD } from './types';
import type { LibraryStore, ShowMetadataPatch } from './store';

const CONTINUE_WATCHING_MAX_RATIO = 0.98;
const FLUSH_DELAY_MS = 300;

type JsonDbShape = {
    version: 1;
    sources: SourceConfig[];
    shows: Show[];
    items: LibraryItem[];
    watchStates: Record<string, WatchState>;
    skipInfos: Record<string, SkipInfo>;
};

function emptyDb(): JsonDbShape {
    return { version: 1, sources: [], shows: [], items: [], watchStates: {}, skipInfos: {} };
}

function sanitizeDb(raw: unknown): JsonDbShape {
    if (raw === null || typeof raw !== 'object') {
        return emptyDb();
    }
    const data = raw as Partial<JsonDbShape>;
    return {
        version: 1,
        sources: Array.isArray(data.sources) ? data.sources : [],
        shows: Array.isArray(data.shows) ? data.shows : [],
        items: Array.isArray(data.items) ? data.items : [],
        watchStates: data.watchStates !== null && typeof data.watchStates === 'object' ? data.watchStates : {},
        skipInfos: data.skipInfos !== null && typeof data.skipInfos === 'object' ? data.skipInfos : {},
    };
}

export class JsonLibraryStore implements LibraryStore {
    private readonly filePath: string;
    private data: JsonDbShape;
    private flushTimer: NodeJS.Timeout | null = null;
    private dirty = false;
    private closed = false;

    constructor(filePath: string) {
        this.filePath = filePath;
        this.data = this.load();
    }

    private load(): JsonDbShape {
        try {
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            return sanitizeDb(JSON.parse(raw));
        } catch {
            return emptyDb();
        }
    }

    private markDirty(): void {
        if (this.closed) {
            throw new Error('Library store is closed');
        }
        this.dirty = true;
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
        }
        this.flushTimer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
        this.flushTimer.unref();
    }

    flush(): void {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (!this.dirty) {
            return;
        }
        const dir = path.dirname(this.filePath);
        fs.mkdirSync(dir, { recursive: true });
        const tmpPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(this.data), 'utf-8');
        fs.renameSync(tmpPath, this.filePath);
        this.dirty = false;
    }

    close(): void {
        this.flush();
        this.closed = true;
    }

    private assertOpen(): void {
        if (this.closed) {
            throw new Error('Library store is closed');
        }
    }

    addSource(input: { type: SourceConfig['type']; name: string; config?: Record<string, string> }): SourceConfig {
        this.assertOpen();
        const source: SourceConfig = {
            id: randomUUID(),
            type: input.type,
            name: input.name,
            config: input.config ? { ...input.config } : {},
            createdAt: Date.now(),
            lastScanAt: null,
        };
        this.data.sources.push(source);
        this.markDirty();
        return source;
    }

    updateSource(source: SourceConfig): void {
        this.assertOpen();
        const index = this.data.sources.findIndex((s) => s.id === source.id);
        if (index >= 0) {
            this.data.sources[index] = { ...source, config: { ...source.config } };
            this.markDirty();
        }
    }

    getSource(id: string): SourceConfig | null {
        this.assertOpen();
        return this.data.sources.find((s) => s.id === id) ?? null;
    }

    listSources(): SourceConfig[] {
        this.assertOpen();
        return [...this.data.sources];
    }

    removeSource(id: string): void {
        this.assertOpen();
        const removedItems = this.data.items.filter((i) => i.sourceId === id);
        const removedShowIds = new Set(this.data.shows.filter((s) => s.sourceId === id).map((s) => s.id));
        this.data.items = this.data.items.filter((i) => i.sourceId !== id);
        this.data.shows = this.data.shows.filter((s) => s.sourceId !== id);
        this.data.sources = this.data.sources.filter((s) => s.id !== id);
        for (const item of removedItems) {
            delete this.data.watchStates[item.id];
            delete this.data.skipInfos[item.id];
        }
        for (const showId of removedShowIds) {
            delete this.data.skipInfos[showId];
        }
        this.markDirty();
    }

    upsertShow(input: NewShow): { show: Show; created: boolean } {
        this.assertOpen();
        const index = this.data.shows.findIndex(
            (s) => s.sourceId === input.sourceId && s.groupKey === input.groupKey
        );
        if (index >= 0) {
            const existing = this.data.shows[index];
            const updated: Show = {
                ...existing,
                title: input.title,
                sortTitle: input.sortTitle ?? existing.sortTitle,
                year: input.year ?? existing.year,
            };
            this.data.shows[index] = updated;
            this.markDirty();
            return { show: updated, created: false };
        }
        const show: Show = {
            id: randomUUID(),
            sourceId: input.sourceId,
            groupKey: input.groupKey,
            title: input.title,
            sortTitle: input.sortTitle ?? null,
            year: input.year ?? null,
            overview: null,
            posterPath: null,
            backdropPath: null,
            tmdbId: null,
        };
        this.data.shows.push(show);
        this.markDirty();
        return { show, created: true };
    }

    getShow(id: string): Show | null {
        this.assertOpen();
        return this.data.shows.find((s) => s.id === id) ?? null;
    }

    listShows(sourceId?: string): Show[] {
        this.assertOpen();
        const shows = sourceId ? this.data.shows.filter((s) => s.sourceId === sourceId) : [...this.data.shows];
        return shows.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    }

    updateShowMetadata(id: string, patch: ShowMetadataPatch): void {
        this.assertOpen();
        const index = this.data.shows.findIndex((s) => s.id === id);
        if (index >= 0) {
            this.data.shows[index] = { ...this.data.shows[index], ...patch };
            this.markDirty();
        }
    }

    upsertItem(input: NewItem): { item: LibraryItem; created: boolean } {
        this.assertOpen();
        const index = this.data.items.findIndex(
            (i) => i.sourceId === input.sourceId && i.filePath === input.filePath
        );
        if (index >= 0) {
            const existing = this.data.items[index];
            // 已刮削/来自 NFO 的条目不回退为文件名元数据，避免重扫覆盖
            const keepCurated = existing.metadataSource !== 'filename';
            const updated: LibraryItem = {
                ...existing,
                kind: input.kind,
                showId: input.showId ?? null,
                title: keepCurated ? existing.title : input.title,
                originalTitle: input.originalTitle ?? existing.originalTitle,
                year: keepCurated ? existing.year : (input.year ?? existing.year),
                season: input.season ?? null,
                episode: input.episode ?? null,
                episodeTitle: keepCurated ? existing.episodeTitle : (input.episodeTitle ?? existing.episodeTitle),
                fileSize: input.fileSize ?? existing.fileSize,
                mtime: input.mtime ?? existing.mtime,
                resolution: input.resolution ?? existing.resolution,
            };
            this.data.items[index] = updated;
            this.markDirty();
            return { item: updated, created: false };
        }
        const item: LibraryItem = {
            id: randomUUID(),
            sourceId: input.sourceId,
            kind: input.kind,
            showId: input.showId ?? null,
            title: input.title,
            originalTitle: input.originalTitle ?? null,
            year: input.year ?? null,
            season: input.season ?? null,
            episode: input.episode ?? null,
            episodeTitle: input.episodeTitle ?? null,
            filePath: input.filePath,
            fileSize: input.fileSize ?? 0,
            mtime: input.mtime ?? 0,
            resolution: input.resolution ?? null,
            overview: null,
            rating: null,
            runtime: null,
            posterPath: null,
            backdropPath: null,
            tmdbId: null,
            metadataSource: 'filename',
            addedAt: Date.now(),
        };
        this.data.items.push(item);
        this.markDirty();
        return { item, created: true };
    }

    getItem(id: string): LibraryItem | null {
        this.assertOpen();
        return this.data.items.find((i) => i.id === id) ?? null;
    }

    getItemByPath(sourceId: string, filePath: string): LibraryItem | null {
        this.assertOpen();
        return this.data.items.find((i) => i.sourceId === sourceId && i.filePath === filePath) ?? null;
    }

    listItems(query?: ListItemQuery): LibraryItem[] {
        this.assertOpen();
        let result = [...this.data.items];
        if (query?.kind) {
            result = result.filter((i) => i.kind === query.kind);
        }
        if (query?.sourceId) {
            result = result.filter((i) => i.sourceId === query.sourceId);
        }
        if (query?.showId) {
            result = result.filter((i) => i.showId === query.showId);
        }
        if (query?.query) {
            const needle = query.query.toLowerCase();
            result = result.filter(
                (i) =>
                    i.title.toLowerCase().includes(needle) ||
                    (i.originalTitle !== null && i.originalTitle.toLowerCase().includes(needle))
            );
        }
        if (query?.watched !== undefined) {
            result = result.filter((i) => {
                const state = this.data.watchStates[i.id];
                const watched = state ? state.watched : false;
                return query.watched === watched;
            });
        }
        const sort = query?.sort ?? 'added';
        result.sort((a, b) => {
            switch (sort) {
                case 'title':
                    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
                case 'year':
                    return (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
                case 'recentPlayed': {
                    const aPlayed = this.data.watchStates[a.id]?.lastPlayedAt ?? 0;
                    const bPlayed = this.data.watchStates[b.id]?.lastPlayedAt ?? 0;
                    return bPlayed - aPlayed;
                }
                case 'added':
                default:
                    return b.addedAt - a.addedAt || a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
            }
        });
        const offset = query?.offset ?? 0;
        if (offset > 0) {
            result = result.slice(offset);
        }
        if (query?.limit !== undefined) {
            result = result.slice(0, query.limit);
        }
        return result;
    }

    countItems(sourceId?: string): number {
        this.assertOpen();
        return sourceId ? this.data.items.filter((i) => i.sourceId === sourceId).length : this.data.items.length;
    }

    updateItemMetadata(id: string, patch: ItemMetadataPatch): void {
        this.assertOpen();
        const index = this.data.items.findIndex((i) => i.id === id);
        if (index >= 0) {
            this.data.items[index] = { ...this.data.items[index], ...patch };
            this.markDirty();
        }
    }

    removeItemsExcept(sourceId: string, keepIds: string[]): string[] {
        this.assertOpen();
        const keepSet = new Set(keepIds);
        const toRemove = this.data.items.filter((i) => i.sourceId === sourceId && !keepSet.has(i.id));
        const removedIds = new Set(toRemove.map((i) => i.id));
        this.data.items = this.data.items.filter((i) => !(i.sourceId === sourceId && !keepSet.has(i.id)));
        for (const id of removedIds) {
            delete this.data.watchStates[id];
            delete this.data.skipInfos[id];
        }
        const referencedShowIds = new Set(this.data.items.map((i) => i.showId).filter((v): v is string => v !== null));
        const orphanShows = this.data.shows.filter((s) => s.sourceId === sourceId && !referencedShowIds.has(s.id));
        for (const show of orphanShows) {
            delete this.data.skipInfos[show.id];
        }
        this.data.shows = this.data.shows.filter(
            (s) => !(s.sourceId === sourceId && !referencedShowIds.has(s.id))
        );
        this.markDirty();
        return toRemove.map((i) => i.id);
    }

    getWatchState(itemId: string): WatchState | null {
        this.assertOpen();
        return this.data.watchStates[itemId] ?? null;
    }

    private upsertWatchState(itemId: string, mutate: (state: WatchState) => WatchState): void {
        const current = this.data.watchStates[itemId];
        const base: WatchState = current ?? {
            itemId,
            watched: false,
            positionTs: 0,
            durationTs: 0,
            lastPlayedAt: null,
            playCount: 0,
        };
        this.data.watchStates[itemId] = mutate({ ...base });
        this.markDirty();
    }

    markPlaybackStart(itemId: string): void {
        this.assertOpen();
        this.upsertWatchState(itemId, (state) => ({
            ...state,
            lastPlayedAt: Date.now(),
            playCount: state.playCount + 1,
        }));
    }

    recordProgress(itemId: string, positionTs: number, durationTs: number): void {
        this.assertOpen();
        this.upsertWatchState(itemId, (state) => ({
            ...state,
            positionTs,
            durationTs,
            watched: state.watched || (durationTs > 0 && positionTs >= AUTO_WATCH_THRESHOLD * durationTs),
            lastPlayedAt: Date.now(),
        }));
    }

    setWatched(itemId: string, watched: boolean): void {
        this.assertOpen();
        this.upsertWatchState(itemId, (state) => ({
            ...state,
            watched,
            positionTs: watched ? state.positionTs : 0,
        }));
    }

    listContinueWatching(limit?: number): WatchedEntry[] {
        this.assertOpen();
        const entries: WatchedEntry[] = [];
        for (const item of this.data.items) {
            const state = this.data.watchStates[item.id];
            if (!state || state.watched) {
                continue;
            }
            if (
                state.positionTs > 0 &&
                state.durationTs > 0 &&
                state.positionTs < CONTINUE_WATCHING_MAX_RATIO * state.durationTs
            ) {
                entries.push({ item, state });
            }
        }
        entries.sort(
            (a, b) => (b.state.lastPlayedAt ?? 0) - (a.state.lastPlayedAt ?? 0)
        );
        return limit !== undefined ? entries.slice(0, limit) : entries;
    }

    listHistory(limit?: number): WatchedEntry[] {
        this.assertOpen();
        const entries: WatchedEntry[] = [];
        for (const item of this.data.items) {
            const state = this.data.watchStates[item.id];
            if (state && state.lastPlayedAt !== null) {
                entries.push({ item, state });
            }
        }
        entries.sort(
            (a, b) => (b.state.lastPlayedAt ?? 0) - (a.state.lastPlayedAt ?? 0)
        );
        return limit !== undefined ? entries.slice(0, limit) : entries;
    }

    getSkipInfo(key: string): SkipInfo | null {
        this.assertOpen();
        return this.data.skipInfos[key] ?? null;
    }

    setSkipInfo(key: string, skipStart: number, skipEnd: number): void {
        this.assertOpen();
        this.data.skipInfos[key] = { key, skipStart, skipEnd };
        this.markDirty();
    }

    removeSkipInfo(key: string): void {
        this.assertOpen();
        delete this.data.skipInfos[key];
        this.markDirty();
    }
}

export function createJsonLibraryStore(filePath: string): JsonLibraryStore {
    return new JsonLibraryStore(filePath);
}
