# Phase 1 Design

## Module layout

```
src/modules/library/
  types.ts        shared model types + ListItemQuery/Sort
  parser.ts       pure filename parsing (no fs, no electron)
  store.ts        LibraryStore interface + createLibraryStore() factory
  sqliteStore.ts  node:sqlite implementation (runtime-detected)
  jsonStore.ts    JSON file fallback (same interface)
  node-sqlite.d.ts minimal ambient types for node:sqlite subset we use
  scanner.ts      local/SMB recursive walk
  ingest.ts       scan result -> parser -> store diff/upsert
  nfo.ts          NFO XML extraction + poster candidates
```

Everything imports the logger through `src/modules/logger` (already
electron-safe via try-require) and never imports `electron` directly, so all
modules are unit-testable under plain Node.

## Data model

- `SourceConfig { id, type: 'local'|'webdav'|'strm'|'fnos', name, config: Record<string,string>, createdAt, lastScanAt }`
- `Show { id, sourceId, title, sortTitle, year, overview, posterPath, tmdbId }`
- `LibraryItem { id, sourceId, kind: 'movie'|'episode', showId?, title, originalTitle, year, season?, episode?, episodeTitle?, filePath, fileSize, mtime, resolution?, overview?, rating?, runtime?, posterPath?, backdropPath?, tmdbId?, metadataSource: 'tmdb'|'nfo'|'filename', addedAt }`
- `WatchState { itemId, watched, positionTs, durationTs, lastPlayedAt, playCount }`
- `SkipInfo { key, skipStart, skipEnd }` — key = showId for episodes, itemId
  for movies (mirrors fnOS parent-level config semantics).

IDs: `crypto.randomUUID()`.

## Store strategy

`createLibraryStore(dbDir)`:
1. try `require('node:sqlite')` → `SqliteLibraryStore` (DatabaseSync,
   WAL pragma, idempotent `CREATE TABLE IF NOT EXISTS` schema below);
2. on failure → `JsonLibraryStore` (load-once, in-memory maps, 300 ms
   debounced flush, `flush()` + `close()` public).

Schema (SQLite):

```sql
sources(id PK, type, name, config JSON, created_at, last_scan_at)
shows(id PK, source_id, title, sort_title, year, overview, poster_path, tmdb_id)
items(id PK, source_id, kind, show_id, title, original_title, year, season,
      episode, episode_title, file_path, file_size, mtime, resolution,
      overview, rating, runtime, poster_path, backdrop_path, tmdb_id,
      metadata_source, added_at, UNIQUE(source_id, file_path))
watch_state(item_id PK, watched, position_ts, duration_ts, last_played_at, play_count)
skip_info(key PK, skip_start, skip_end)
-- indexes: items(show_id), items(source_id), items(kind)
```

`listItems` supports `{ kind?, sourceId?, showId?, watched?, query?, sort?,
limit?, offset? }`; sorts: added/title/year/lastPlayed/recentPlayed. Offset
pagination is acceptable for a local single-user DB (documented deviation from
the cursor-pagination spec guideline, which targets network APIs).

Upsert semantics: `upsertItem` matches on (source_id, file_path) and preserves
the existing item id + added_at; watch_state rows are never touched by ingest
so progress survives re-scans and file moves.

## Parser rules (pure string -> ParsedVideoName)

1. Normalize: strip extension, replace `._` separators with spaces, collapse
   whitespace, strip bracketed release tags `[...]`.
2. Season/episode: `S(\d{1,2})E(\d{1,3})`, `(\d{1,2})x(\d{2,3})`,
   `Season (\d{1,2}) .* Episode (\d{1,3})`, `第(\d{1,2})季`, `第(\d{1,4})集`,
   `EP?\.?\s*(\d{1,4})` (token-start), anime trailing ` - (\d{1,4})`.
3. Year: standalone `(19|20)\d{2}` outside the episode match; keep first match.
4. Resolution: `2160p|1080p|720p|480p|4[kK]` → canonical `2160p` for 4k.
5. Sample detection: `sample` as a path segment or token (case-insensitive).
6. Title = text before the first matched marker (year / season / resolution),
   trailing `- _ .` trimmed; empty after trim → fall back to full cleaned name.
7. `buildShowKey(title, year)` = lowercased de-spaced title + `@` + year for
   grouping episodes into shows.

## Scanner + ingest

`scanLocalFolder({ rootPath, excludePatterns, maxDepth=12, maxFiles=200000, onProgress })`:
iterative stack walk; skip names starting with `.`; skip junk dirs
(`$RECYCLE.BIN`, `System Volume Information`, `lost+found`, `@eaDir`,
`Recycled`); extension whitelist in `VIDEO_EXTENSIONS` (includes `.strm`);
collect `{ path, size, mtime, isSample }`; readdir errors become `ScanError`s
and scanning continues.

`ingestScanResult(store, sourceId, scan)`:
- parse each file; sample files skipped;
- episodes grouped via `buildShowKey` → upsertShow once per key;
- `upsertItem` per file (movie or episode), metadataSource 'filename' unless
  NFO found (Phase 1 wires NFO only as metadata seed when present);
- after ingest, `removeItemsExcept(sourceId, keptIds)` removes vanished files;
- returns `{ added, updated, removed }` summary for logging/UI.

## NFO reader

`extractNfoMetadata(xml)` handles roots `<movie>`, `<episodedetails>`,
`<tvshow>`: title, originaltitle, year, season, episode, plot, rating,
runtime, tmdbid, showtitle, thumb (first). Regex-based tag extraction with
entity decoding (`&amp;` etc.) and CDATA tolerance; returns null on parse
failure so ingest can fall back to filename data.

`findPosterForVideo(dir, baseName)` candidate order: `<base>-poster.jpg`,
`<base>.jpg`, `poster.jpg/png`, `folder.jpg/png`, `cover.jpg/png`;
episodes additionally `<base>-thumb.jpg`.

## Trade-offs

- Hand-rolled XML/NFO parsing over adding a dependency (project is
  zero-extra-dep); sufficient for Kodi-style NFO generated by scrapers.
- JSON fallback kept for environments where node:sqlite is unavailable
  (older Electron builds); interface-identical so Phase 3+ code never branches.
- Scanner intentionally does not watch the FS (no chokidar); re-scan is
  explicit/scheduled by later phases.
