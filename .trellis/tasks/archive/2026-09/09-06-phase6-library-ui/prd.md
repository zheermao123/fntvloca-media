# Phase 6: Unified Library UI

## Goal

Local library page as the app home: browse/scrape/play from the unified
library, manage local sources and scraper settings, replacing the fnOS web
page as the startup surface (fast-usable path).

## Requirements

1. `resource/library/index.html` — self-contained page (vanilla JS, CSP like
   login page): continue-watching row, poster wall / list toggle, search,
   filters (all/movie/tv/unwatched/watched) + sort, detail overlay (show
   episodes, movie versions visible in wall), watched toggle, play button,
   sources manager (pick local folder, rescan, remove), settings (TMDB key /
   language / api & image base), scrape trigger with progress display.
2. IPC surface (new plugin `handlers/plugins/library.ts`):
   `library:pick-folder`, `library:add-source`, `library:list-sources`,
   `library:remove-source`, `library:scan`, `library:items`, `library:item`,
   `library:continue`, `library:set-watched`, `library:scrape`,
   `library:scrape-status`, `library:settings-get`, `library:settings-set`;
   main→renderer push `library-scrape-progress`.
   Playback stays on `play-library-item` (media.ts).
3. fn_config: add scraper settings `tmdbApiKey` (safeStorage-encrypted),
   `tmdbApiBase`, `tmdbImageBase`, `tmdbLanguage` + getters.
4. preload: extend whitelisted SEND/RECEIVE channels with the library set.
5. Startup: `winctrl` loads `resource/library/index.html` instead of the fnOS
   login flow (fnOS restore logic kept for the deferred fnOS phase).
6. Poster images: renderer converts local paths to `file://` URLs.
7. `node:test` additions where pure (settings mapping), full suite stays green.

## Acceptance Criteria

- App starts into the library page; scanning a folder, scraping with a key,
  browsing, and playing via MPV all work end to end.
- Existing tests stay green; new tests for scraper-settings mapping.
