import { randomUUID } from 'crypto';
import type { SqliteDatabase, SqliteStatement } from './sqliteModule';
import type {
    LibraryItem,
    ListItemQuery,
    MetadataSource,
    NewItem,
    NewShow,
    SeasonInfo,
    Show,
    SkipInfo,
    SourceConfig,
    WatchedEntry,
    WatchState,
} from './types';
import { AUTO_WATCH_THRESHOLD } from './types';
import type { LibraryStore, ShowMetadataPatch } from './store';

const CONTINUE_WATCHING_MAX_RATIO = 0.98;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_scan_at INTEGER
);
CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  group_key TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_title TEXT,
  year INTEGER,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  tmdb_id TEXT
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  show_id TEXT,
  title TEXT NOT NULL,
  original_title TEXT,
  year INTEGER,
  season INTEGER,
  episode INTEGER,
  episode_title TEXT,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mtime INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  overview TEXT,
  rating REAL,
  runtime INTEGER,
  poster_path TEXT,
  backdrop_path TEXT,
  tmdb_id TEXT,
  metadata_source TEXT NOT NULL DEFAULT 'filename',
  added_at INTEGER NOT NULL,
  UNIQUE(source_id, file_path)
);
CREATE INDEX IF NOT EXISTS idx_items_show ON items(show_id);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_items_kind ON items(kind);
CREATE TABLE IF NOT EXISTS watch_state (
  item_id TEXT PRIMARY KEY,
  watched INTEGER NOT NULL DEFAULT 0,
  position_ts REAL NOT NULL DEFAULT 0,
  duration_ts REAL NOT NULL DEFAULT 0,
  last_played_at INTEGER,
  play_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS skip_info (
  key TEXT PRIMARY KEY,
  skip_start REAL NOT NULL DEFAULT 0,
  skip_end REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS seasons (
  show_id TEXT NOT NULL,
  season INTEGER NOT NULL,
  poster_path TEXT,
  name TEXT,
  overview TEXT,
  air_date TEXT,
  PRIMARY KEY (show_id, season)
);
`;

type SourceRow = {
    id: string;
    type: string;
    name: string;
    config: string;
    created_at: number;
    last_scan_at: number | null;
};

type ShowRow = {
    id: string;
    source_id: string;
    group_key: string;
    title: string;
    sort_title: string | null;
    year: number | null;
    overview: string | null;
    poster_path: string | null;
    backdrop_path: string | null;
    tmdb_id: string | null;
};

type ItemRow = {
    id: string;
    source_id: string;
    kind: string;
    show_id: string | null;
    title: string;
    original_title: string | null;
    year: number | null;
    season: number | null;
    episode: number | null;
    episode_title: string | null;
    file_path: string;
    file_size: number;
    mtime: number;
    resolution: string | null;
    overview: string | null;
    rating: number | null;
    runtime: number | null;
    poster_path: string | null;
    backdrop_path: string | null;
    tmdb_id: string | null;
    metadata_source: string;
    added_at: number;
};

type WatchRow = {
    item_id: string;
    watched: number;
    position_ts: number;
    duration_ts: number;
    last_played_at: number | null;
    play_count: number;
};

function rowToSource(row: SourceRow): SourceConfig {
    let config: Record<string, string> = {};
    try {
        const parsed: unknown = JSON.parse(row.config);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
            config = parsed as Record<string, string>;
        }
    } catch {
        config = {};
    }
    return {
        id: row.id,
        type: row.type as SourceConfig['type'],
        name: row.name,
        config,
        createdAt: row.created_at,
        lastScanAt: row.last_scan_at,
    };
}

function rowToShow(row: ShowRow): Show {
    return {
        id: row.id,
        sourceId: row.source_id,
        groupKey: row.group_key,
        title: row.title,
        sortTitle: row.sort_title,
        year: row.year,
        overview: row.overview,
        posterPath: row.poster_path,
        backdropPath: row.backdrop_path,
        tmdbId: row.tmdb_id,
    };
}

function rowToItem(row: ItemRow): LibraryItem {
    return {
        id: row.id,
        sourceId: row.source_id,
        kind: row.kind as LibraryItem['kind'],
        showId: row.show_id,
        title: row.title,
        originalTitle: row.original_title,
        year: row.year,
        season: row.season,
        episode: row.episode,
        episodeTitle: row.episode_title,
        filePath: row.file_path,
        fileSize: Number(row.file_size ?? 0),
        mtime: Number(row.mtime ?? 0),
        resolution: row.resolution,
        overview: row.overview,
        rating: row.rating,
        runtime: row.runtime,
        posterPath: row.poster_path,
        backdropPath: row.backdrop_path,
        tmdbId: row.tmdb_id,
        metadataSource: row.metadata_source as MetadataSource,
        addedAt: row.added_at,
    };
}

function rowToWatch(row: WatchRow): WatchState {
    return {
        itemId: row.item_id,
        watched: row.watched === 1,
        positionTs: row.position_ts,
        durationTs: row.duration_ts,
        lastPlayedAt: row.last_played_at,
        playCount: row.play_count,
    };
}

export class SqliteLibraryStore implements LibraryStore {
    private readonly db: SqliteDatabase;
    private readonly statements = new Map<string, SqliteStatement>();
    private closed = false;

    constructor(db: SqliteDatabase) {
        this.db = db;
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec(SCHEMA);
    }

    private stmt(sql: string): SqliteStatement {
        let statement = this.statements.get(sql);
        if (!statement) {
            statement = this.db.prepare(sql);
            this.statements.set(sql, statement);
        }
        return statement;
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
        this.stmt('INSERT INTO sources (id, type, name, config, created_at, last_scan_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(source.id, source.type, source.name, JSON.stringify(source.config), source.createdAt, null);
        return source;
    }

    updateSource(source: SourceConfig): void {
        this.assertOpen();
        this.stmt('UPDATE sources SET type = ?, name = ?, config = ?, created_at = ?, last_scan_at = ? WHERE id = ?')
            .run(source.type, source.name, JSON.stringify(source.config), source.createdAt, source.lastScanAt, source.id);
    }

    getSource(id: string): SourceConfig | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow | undefined;
        return row ? rowToSource(row) : null;
    }

    listSources(): SourceConfig[] {
        this.assertOpen();
        const rows = this.stmt('SELECT * FROM sources ORDER BY created_at ASC').all() as SourceRow[];
        return rows.map(rowToSource);
    }

    removeSource(id: string): void {
        this.assertOpen();
        this.stmt(`DELETE FROM watch_state WHERE item_id IN (SELECT id FROM items WHERE source_id = ?)`).run(id);
        this.stmt(`DELETE FROM skip_info WHERE key IN (SELECT id FROM items WHERE source_id = ?)
            OR key IN (SELECT id FROM shows WHERE source_id = ?)`).run(id, id);
        this.stmt(`DELETE FROM seasons WHERE show_id IN (SELECT id FROM shows WHERE source_id = ?)`).run(id);
        this.stmt('DELETE FROM items WHERE source_id = ?').run(id);
        this.stmt('DELETE FROM shows WHERE source_id = ?').run(id);
        this.stmt('DELETE FROM sources WHERE id = ?').run(id);
    }

    upsertShow(input: NewShow): { show: Show; created: boolean } {
        this.assertOpen();
        const existing = this.stmt('SELECT id FROM shows WHERE source_id = ? AND group_key = ?')
            .get(input.sourceId, input.groupKey) as { id: string } | undefined;
        if (existing) {
            this.stmt('UPDATE shows SET title = ?, sort_title = ?, year = ? WHERE id = ?')
                .run(input.title, input.sortTitle ?? null, input.year ?? null, existing.id);
            const show = this.getShow(existing.id);
            if (show) {
                return { show, created: false };
            }
        }
        const id = randomUUID();
        this.stmt(
            'INSERT INTO shows (id, source_id, group_key, title, sort_title, year, overview, poster_path, backdrop_path, tmdb_id) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)'
        ).run(id, input.sourceId, input.groupKey, input.title, input.sortTitle ?? null, input.year ?? null);
        const show = this.getShow(id);
        if (!show) {
            throw new Error('Failed to create show');
        }
        return { show, created: true };
    }

    getShow(id: string): Show | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM shows WHERE id = ?').get(id) as ShowRow | undefined;
        return row ? rowToShow(row) : null;
    }

    listShows(sourceId?: string): Show[] {
        this.assertOpen();
        const rows = sourceId
            ? (this.stmt('SELECT * FROM shows WHERE source_id = ? ORDER BY title COLLATE NOCASE ASC').all(sourceId) as ShowRow[])
            : (this.stmt('SELECT * FROM shows ORDER BY title COLLATE NOCASE ASC').all() as ShowRow[]);
        return rows.map(rowToShow);
    }

    updateShowMetadata(id: string, patch: ShowMetadataPatch): void {
        this.assertOpen();
        const current = this.getShow(id);
        if (!current) {
            return;
        }
        const next = { ...current, ...patch };
        this.stmt('UPDATE shows SET title = ?, year = ?, overview = ?, poster_path = ?, backdrop_path = ?, tmdb_id = ? WHERE id = ?')
            .run(next.title, next.year, next.overview, next.posterPath, next.backdropPath, next.tmdbId, id);
    }

    upsertSeason(input: {
        showId: string;
        season: number;
        posterPath?: string | null;
        name?: string | null;
        overview?: string | null;
        airDate?: string | null;
    }): void {
        this.assertOpen();
        this.stmt(
            `INSERT INTO seasons (show_id, season, poster_path, name, overview, air_date)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(show_id, season) DO UPDATE SET
             poster_path = COALESCE(excluded.poster_path, seasons.poster_path),
             name = COALESCE(excluded.name, seasons.name),
             overview = COALESCE(excluded.overview, seasons.overview),
             air_date = COALESCE(excluded.air_date, seasons.air_date)`
        ).run(
            input.showId,
            input.season,
            input.posterPath ?? null,
            input.name ?? null,
            input.overview ?? null,
            input.airDate ?? null
        );
    }

    getSeason(showId: string, season: number): SeasonInfo | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM seasons WHERE show_id = ? AND season = ?')
            .get(showId, season) as {
            show_id: string;
            season: number;
            poster_path: string | null;
            name: string | null;
            overview: string | null;
            air_date: string | null;
        } | undefined;
        if (!row) {
            return null;
        }
        return {
            showId: row.show_id,
            season: row.season,
            posterPath: row.poster_path,
            name: row.name,
            overview: row.overview,
            airDate: row.air_date,
        };
    }

    listSeasons(showId: string): SeasonInfo[] {
        this.assertOpen();
        const rows = this.stmt('SELECT * FROM seasons WHERE show_id = ? ORDER BY season ASC')
            .all(showId) as Array<{
            show_id: string;
            season: number;
            poster_path: string | null;
            name: string | null;
            overview: string | null;
            air_date: string | null;
        }>;
        return rows.map((row) => ({
            showId: row.show_id,
            season: row.season,
            posterPath: row.poster_path,
            name: row.name,
            overview: row.overview,
            airDate: row.air_date,
        }));
    }

    upsertItem(input: NewItem): { item: LibraryItem; created: boolean } {
        this.assertOpen();
        const existing = this.stmt('SELECT id, added_at, title, year, episode_title, metadata_source FROM items WHERE source_id = ? AND file_path = ?')
            .get(input.sourceId, input.filePath) as
            | { id: string; added_at: number; title: string; year: number | null; episode_title: string | null; metadata_source: string }
            | undefined;
        if (existing) {
            // 已刮削/来自 NFO 的条目不回退为文件名元数据，避免重扫覆盖
            const keepCurated = existing.metadata_source !== 'filename';
            this.stmt(
                `UPDATE items SET kind = ?, show_id = ?, title = ?, original_title = ?, year = ?, season = ?,
                 episode = ?, episode_title = ?, file_size = ?, mtime = ?, resolution = ? WHERE id = ?`
            ).run(
                input.kind,
                input.showId ?? null,
                keepCurated ? existing.title : input.title,
                input.originalTitle ?? null,
                keepCurated ? existing.year : (input.year ?? null),
                input.season ?? null,
                input.episode ?? null,
                keepCurated ? existing.episode_title : (input.episodeTitle ?? null),
                input.fileSize ?? 0,
                input.mtime ?? 0,
                input.resolution ?? null,
                existing.id
            );
            const item = this.getItem(existing.id);
            if (item) {
                return { item, created: false };
            }
        }
        const id = randomUUID();
        const addedAt = Date.now();
        this.stmt(
            `INSERT INTO items (id, source_id, kind, show_id, title, original_title, year, season, episode,
             episode_title, file_path, file_size, mtime, resolution, overview, rating, runtime, poster_path,
             backdrop_path, tmdb_id, metadata_source, added_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 'filename', ?)`
        ).run(
            id,
            input.sourceId,
            input.kind,
            input.showId ?? null,
            input.title,
            input.originalTitle ?? null,
            input.year ?? null,
            input.season ?? null,
            input.episode ?? null,
            input.episodeTitle ?? null,
            input.filePath,
            input.fileSize ?? 0,
            input.mtime ?? 0,
            input.resolution ?? null,
            addedAt
        );
        const item = this.getItem(id);
        if (!item) {
            throw new Error('Failed to create library item');
        }
        return { item, created: true };
    }

    getItem(id: string): LibraryItem | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined;
        return row ? rowToItem(row) : null;
    }

    getItemByPath(sourceId: string, filePath: string): LibraryItem | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM items WHERE source_id = ? AND file_path = ?')
            .get(sourceId, filePath) as ItemRow | undefined;
        return row ? rowToItem(row) : null;
    }

    listItems(query?: ListItemQuery): LibraryItem[] {
        this.assertOpen();
        const conditions: string[] = [];
        const params: unknown[] = [];
        const needsWatchJoin = Boolean(query?.watched !== undefined || query?.sort === 'recentPlayed');

        if (query?.kind) {
            conditions.push('i.kind = ?');
            params.push(query.kind);
        }
        if (query?.sourceId) {
            conditions.push('i.source_id = ?');
            params.push(query.sourceId);
        }
        if (query?.showId) {
            conditions.push('i.show_id = ?');
            params.push(query.showId);
        }
        if (query?.query) {
            conditions.push('(LOWER(i.title) LIKE ? OR LOWER(i.original_title) LIKE ?)');
            const needle = `%${query.query.toLowerCase()}%`;
            params.push(needle, needle);
        }
        if (query?.watched !== undefined) {
            conditions.push(query.watched ? 'w.watched = 1' : 'COALESCE(w.watched, 0) = 0');
        }

        const join = needsWatchJoin ? 'LEFT JOIN watch_state w ON w.item_id = i.id' : '';
        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderBy = this.buildOrderBy(query?.sort);
        const limit = query?.limit ?? -1;
        const offset = query?.offset ?? 0;

        const sql = `SELECT i.* FROM items i ${join} ${where} ${orderBy} LIMIT ? OFFSET ?`;
        const rows = this.stmt(sql).all(...params, limit, offset) as ItemRow[];
        return rows.map(rowToItem);
    }

    private buildOrderBy(sort?: ListItemQuery['sort']): string {
        switch (sort) {
            case 'title':
                return 'ORDER BY i.title COLLATE NOCASE ASC';
            case 'year':
                return 'ORDER BY i.year DESC, i.title COLLATE NOCASE ASC';
            case 'recentPlayed':
                return 'ORDER BY COALESCE(w.last_played_at, 0) DESC';
            case 'added':
            default:
                return 'ORDER BY i.added_at DESC, i.title COLLATE NOCASE ASC';
        }
    }

    countItems(sourceId?: string): number {
        this.assertOpen();
        const row = sourceId
            ? (this.stmt('SELECT COUNT(*) AS total FROM items WHERE source_id = ?').get(sourceId) as { total: number })
            : (this.stmt('SELECT COUNT(*) AS total FROM items').get() as { total: number });
        return Number(row.total);
    }

    updateItemMetadata(id: string, patch: {
        title?: string;
        overview?: string | null;
        rating?: number | null;
        runtime?: number | null;
        posterPath?: string | null;
        backdropPath?: string | null;
        tmdbId?: string | null;
        metadataSource?: MetadataSource;
    }): void {
        this.assertOpen();
        const current = this.getItem(id);
        if (!current) {
            return;
        }
        const next = { ...current, ...patch };
        this.stmt(
            `UPDATE items SET title = ?, episode_title = ?, overview = ?, rating = ?, runtime = ?, poster_path = ?,
             backdrop_path = ?, tmdb_id = ?, metadata_source = ? WHERE id = ?`
        ).run(next.title, next.episodeTitle, next.overview, next.rating, next.runtime, next.posterPath, next.backdropPath, next.tmdbId, next.metadataSource, id);
    }

    removeItemsExcept(sourceId: string, keepIds: string[]): string[] {
        this.assertOpen();
        const all = this.stmt('SELECT id FROM items WHERE source_id = ?').all(sourceId) as Array<{ id: string }>;
        const keepSet = new Set(keepIds);
        const toRemove = all.filter((row) => !keepSet.has(row.id)).map((row) => row.id);
        for (const id of toRemove) {
            this.stmt('DELETE FROM watch_state WHERE item_id = ?').run(id);
            this.stmt('DELETE FROM skip_info WHERE key = ?').run(id);
            this.stmt('DELETE FROM items WHERE id = ?').run(id);
        }
        this.stmt(
            `DELETE FROM skip_info WHERE key IN (
               SELECT s.id FROM shows s
               LEFT JOIN items i ON i.show_id = s.id
               WHERE s.source_id = ? AND i.id IS NULL
             )`
        ).run(sourceId);
        this.stmt(
            `DELETE FROM seasons WHERE show_id IN (
               SELECT s.id FROM shows s
               LEFT JOIN items i ON i.show_id = s.id
               WHERE s.source_id = ? AND i.id IS NULL
             )`
        ).run(sourceId);
        this.stmt(
            `DELETE FROM shows WHERE source_id = ? AND id NOT IN (SELECT DISTINCT show_id FROM items WHERE show_id IS NOT NULL)`
        ).run(sourceId);
        return toRemove;
    }

    getWatchState(itemId: string): WatchState | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM watch_state WHERE item_id = ?').get(itemId) as WatchRow | undefined;
        return row ? rowToWatch(row) : null;
    }

    private upsertWatchState(itemId: string, mutate: (state: WatchState) => WatchState): void {
        const current = this.getWatchState(itemId);
        const base: WatchState = current ?? {
            itemId,
            watched: false,
            positionTs: 0,
            durationTs: 0,
            lastPlayedAt: null,
            playCount: 0,
        };
        const next = mutate({ ...base });
        this.stmt(
            `INSERT INTO watch_state (item_id, watched, position_ts, duration_ts, last_played_at, play_count)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(item_id) DO UPDATE SET watched = excluded.watched, position_ts = excluded.position_ts,
             duration_ts = excluded.duration_ts, last_played_at = excluded.last_played_at, play_count = excluded.play_count`
        ).run(
            itemId,
            next.watched ? 1 : 0,
            next.positionTs,
            next.durationTs,
            next.lastPlayedAt,
            next.playCount
        );
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
        this.upsertWatchState(itemId, (state) => {
            const watched = state.watched || (durationTs > 0 && positionTs >= AUTO_WATCH_THRESHOLD * durationTs);
            return {
                ...state,
                positionTs,
                durationTs,
                watched,
                lastPlayedAt: Date.now(),
            };
        });
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
        const rows = this.stmt(
            `SELECT i.*, w.position_ts AS w_position, w.duration_ts AS w_duration, w.last_played_at AS w_last_played,
             w.play_count AS w_play_count
             FROM items i JOIN watch_state w ON w.item_id = i.id
             WHERE w.watched = 0 AND w.position_ts > 0 AND w.duration_ts > 0
             AND w.position_ts < ? * w.duration_ts
             ORDER BY w.last_played_at DESC
             LIMIT ?`
        ).all(CONTINUE_WATCHING_MAX_RATIO, limit ?? -1) as Array<ItemRow & {
            w_position: number;
            w_duration: number;
            w_last_played: number | null;
            w_play_count: number;
        }>;
        return rows.map((row) => ({
            item: rowToItem(row),
            state: {
                itemId: row.id,
                watched: false,
                positionTs: row.w_position,
                durationTs: row.w_duration,
                lastPlayedAt: row.w_last_played,
                playCount: row.w_play_count,
            },
        }));
    }

    listHistory(limit?: number): WatchedEntry[] {
        this.assertOpen();
        const rows = this.stmt(
            `SELECT i.*, w.watched AS w_watched, w.position_ts AS w_position, w.duration_ts AS w_duration,
             w.last_played_at AS w_last_played, w.play_count AS w_play_count
             FROM items i JOIN watch_state w ON w.item_id = i.id
             WHERE w.last_played_at IS NOT NULL
             ORDER BY w.last_played_at DESC
             LIMIT ?`
        ).all(limit ?? -1) as Array<ItemRow & {
            w_watched: number;
            w_position: number;
            w_duration: number;
            w_last_played: number | null;
            w_play_count: number;
        }>;
        return rows.map((row) => ({
            item: rowToItem(row),
            state: {
                itemId: row.id,
                watched: row.w_watched === 1,
                positionTs: row.w_position,
                durationTs: row.w_duration,
                lastPlayedAt: row.w_last_played,
                playCount: row.w_play_count,
            },
        }));
    }

    getSkipInfo(key: string): SkipInfo | null {
        this.assertOpen();
        const row = this.stmt('SELECT * FROM skip_info WHERE key = ?').get(key) as
            | { key: string; skip_start: number; skip_end: number }
            | undefined;
        if (!row) {
            return null;
        }
        return { key: row.key, skipStart: row.skip_start, skipEnd: row.skip_end };
    }

    setSkipInfo(key: string, skipStart: number, skipEnd: number): void {
        this.assertOpen();
        this.stmt(
            `INSERT INTO skip_info (key, skip_start, skip_end) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET skip_start = excluded.skip_start, skip_end = excluded.skip_end`
        ).run(key, skipStart, skipEnd);
    }

    removeSkipInfo(key: string): void {
        this.assertOpen();
        this.stmt('DELETE FROM skip_info WHERE key = ?').run(key);
    }

    flush(): void {
        this.assertOpen();
    }

    close(): void {
        if (!this.closed) {
            this.closed = true;
            this.statements.clear();
            this.db.close();
        }
    }
}
