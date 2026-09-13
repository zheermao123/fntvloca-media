# Phase 2: TMDB Online Scraper

## Goal

Mandatory online metadata for the unified library: search TMDB for movies and
TV shows, cache posters/backdrops/stills locally, and write scraped metadata
into the library store.

## Requirements

1. `src/modules/library/tmdb.ts` — TMDB client with injectable transport
   (default axios): searchMovie/searchTv, movie detail, tv detail + season
   detail; configurable `apiBaseUrl` / `imageBaseUrl` / `language` (mirror
   support) and user-provided `apiKey`.
2. `src/modules/library/scraper.ts` — `LibraryScraper`:
   - `scrapeLibrary({ onProgress })`: movies and shows with
     `metadataSource !== 'tmdb'`; sequential with rate-limit delay (injectable
     for tests); per-item failure isolation; summary counts.
   - `scrapeItem(itemId)`: single manual re-scrape.
   - `searchMovie/searchTv(query, year?)` + `applyMatch(...)` for the manual
     match UI.
   - TV shows: episode names + still images mapped to episode items.
3. Poster cache: images downloaded to a caller-provided cache dir; stable
   filenames (`{type}_{tmdbId}_{role}.jpg`) so repeat scrapes skip downloads;
   `posterPath`/`backdropPath` point to local files.
4. Year-aware best-match selection from search results; no result → leave
   metadataSource as-is and count as skipped/failed.
5. Missing/empty `apiKey` → explicit error before any network call.
6. `node:test` coverage with fake transport (no network in tests).

## Acceptance Criteria

- `npm run compile` clean; `npm test` green with new tests/libraryScraper.test.cjs.
- Scraper runs against the store interface only (no electron import).
