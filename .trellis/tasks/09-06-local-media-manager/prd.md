# Multi-Source Local Media Manager

Parent task: transform fntv-electron from a fnOS-only client into a multi-source
local media manager, while keeping fnOS as one source type and preserving 100%
of the existing playback capabilities.

## Goal

Unify five media sources (local disk / SMB, WebDAV, STRM direct links, fnOS NAS)
under one library UI with online scraping, and keep the proven MPV playback
stack (danmaku, subtitles, Anime4K, resume, skip intro/outro) working for every
source.

## Background

- Today the app only browses a fnOS server: the window loads the remote web UI
  (`{domain}/v`), lists items via `fn_api`, and plays through the local Go proxy.
- Playback capabilities that are already local and source-agnostic: MPV player
  abstraction (`src/modules/players/`), mpv config sync + uosc_danmaku +
  Anime4K (`src/main/common/mpvConfigHelpers.ts`, external fntv-mpv-config),
  resume (`players/impl/mpv.ts` seekWithRetry), proxy session security model.
- Decisions confirmed by the user:
  1. Keep fnOS as one source type (login / access code / OAuth stay).
  2. Online scraping is mandatory (TMDB, mirror base URLs configurable).
  3. Cloud drives are consumed via STRM files + WebDAV, not native cloud APIs.

## Requirements

1. Unified library data model stored locally (SQLite via `node:sqlite`, JSON
   fallback behind the same interface): sources, shows/items, watch state,
   progress, skip info.
2. Source adapters: local folder (incl. SMB UNC/mounted paths), WebDAV
   (PROPFIND), STRM files, fnOS (existing `fn_api` flows).
3. Mandatory online scraping via TMDB: poster/backdrop/overview/rating; API and
   image base URLs configurable for mirrors. NFO + poster.jpg/folder.jpg files
   are honored when present; filename parsing is the fallback identifier.
4. Library UI (local page `resource/library/index.html`, vanilla JS, preload
   whitelist IPC): poster wall, list view, detail page (seasons/episodes,
   version selection), continue-watching, search, filters, source management,
   scraping management, settings.
5. Playback chain rework: `media.ts` builds playlists from library items; Go
   proxy gains "direct target" sessions (URL + headers registered per itemGuid)
   alongside the existing fnOS path; progress/watch-state written to local DB
   (fnOS items also sync to server); skip info for local items served by the
   proxy from a local store; sidecar subtitles auto-mounted for local files.
6. All existing playback enhancements keep working: danmaku auto-match,
   Anime4K presets, skip intro/outlo modes, volume memory, resume with retry.
7. Security model unchanged: credentials via safeStorage, renderer isolation,
   proxy secret via stdin, 256-bit playback sessions with itemGuid whitelists.
8. Existing tests keep passing; new modules get `node:test` coverage.

## Acceptance Criteria

- App starts straight into the unified library UI (no forced fnOS login).
- A local folder with mixed movies/episodes is scanned, scraped, and playable.
- STRM and WebDAV items play through the local proxy with range support.
- fnOS source still logs in, syncs items into the same library, plays, reports
  progress to the server, and keeps access-code behavior.
- `npm test` green, `npm run compile` clean, three-platform packaging intact.

## Child Tasks

Delivery order updated by user decision (fast-usable path first):

- 09-06-phase1-data-layer — storage, filename parser, scanner, NFO reader (DONE)
- 09-06-phase2-scraper — TMDB client + pipeline + poster cache
- 09-06-phase3-playback — media.ts rework, proxy direct-target sessions, STRM
- 09-06-phase6-library-ui — unified library page + preload API + flows
- 09-06-phase7-cleanup-packaging — tray/settings integration, cleanup, builds
- 09-06-phase4-webdav — WebDAV scanner + direct-target playback (in progress)
- 09-06-phase5-fnos-adapter — **FROZEN (2026-09-13)**: user has no fnOS server to
  verify against; fnOS code (login/API/OAuth/access-code) is retained in the
  repository and the task can be revived unchanged when a NAS is available.
