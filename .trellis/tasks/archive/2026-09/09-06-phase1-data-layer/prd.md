# Phase 1: Library Data Layer

## Goal

Deliver the persistence and scanning foundation of the unified media library so
later phases (scraper, playback, UI) can build on it: typed data model, local
storage, filename parsing, local/SMB folder scanning, and NFO/local-poster
reading.

## Requirements

1. Shared types for Source / Show / LibraryItem / WatchState / SkipInfo
   (`src/modules/library/types.ts`).
2. `LibraryStore` interface with SQLite implementation via `node:sqlite` and a
   JSON-file fallback selected at runtime; both pass the same test suite.
   Tables/collections: sources, shows, items (UNIQUE(source_id, file_path)),
   watch_state, skip_info.
3. Store operations: source CRUD, show upsert, item upsert/list (filter by
   kind/source/show/watched + text search + sort + limit), metadata update,
   remove-by-source, diff-remove missing paths, watch progress/watched updates,
   continue-watching and history lists, skip info get/set.
4. Pure filename parser (`parser.ts`): title, year, season, episode, episode
   title, resolution tags, sample detection; Chinese and English naming
   conventions; show-key grouping helper.
5. Local/SMB scanner (`scanner.ts`): recursive walk via fs promises, video
   extension whitelist, hidden/junk/system dir exclusion, per-file error
   collection, depth and count guards; works on UNC paths.
6. Ingest step (`ingest.ts`): scan result + parser + store → upsert/update/
   remove items, group episodes into shows, keep watch state across re-scans.
7. NFO + artwork reader (`nfo.ts`): hand-rolled extraction of Kodi-style
   `<movie>` / `<episodedetails>` / `<tvshow>` tags, poster candidate lookup
   (poster.jpg, folder.jpg, cover.jpg, basename-*.jpg), no new dependencies.
8. `node:test` coverage for parser, store (both impls), scanner, ingest, nfo.

## Acceptance Criteria

- `npm run compile` clean; `npm test` green including new
  tests/library*.test.cjs suites.
- Existing 14 test files untouched and still passing.
- No new npm dependencies; Electron-independent modules (importable in plain
  Node) except where electron APIs are optional/absent.
