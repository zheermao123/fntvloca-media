# Phase 2 Implementation Plan

1. [x] `tmdb.ts` — types, default axios transport, TmdbClient (search/detail).
2. [x] `scraper.ts` — LibraryScraper pipeline + cache + match helpers.
3. [x] `tests/libraryScraper.test.cjs` — fake transport suite (11 cases).
4. [x] Full verify: `npm run compile` + `npm test` (103/103 at phase end).

# Phase 3 Implementation (appended)

Scope decision (fast-usable path): local files + STRM + sidecar subtitles +
local progress/watch-state; Go-proxy target sessions and local skipinfo are
DEFERRED together with WebDAV/fnOS phases (STRM URLs play via MPV directly).

1. [x] `players/types.ts` — Config.fnapi now `fn.ApiService | null`.
2. [x] `players/impl/mpv.ts` — resolveItemGuid (URL first, playlist playLink
       fallback for local paths), subtitle flow guarded by fnapi presence,
       resume seek works when duration unknown (local files).
3. [x] `library/playback.ts` — pure playlist builder (episode ordering, resume
       ts, strm resolution) + findSidecarSubtitles; tests in
       tests/libraryPlayback.test.cjs (8 cases).
4. [x] `library/libraryService.ts` — electron store/cache-dir singletons.
5. [x] `main/handlers/plugins/media.ts` — new `play-library-item` IPC, shared
       buildMpvArgs, libraryEventHandler (PROGRESS/EXIT → store.recordProgress),
       markPlaybackStart, sidecar `--sub-file` mounting.
6. [x] Full verify: 111/111 tests pass, compile clean.

## Validation

```
npm run compile
npm test
```
