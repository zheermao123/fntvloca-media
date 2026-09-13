# Phase 1 Implementation Plan

## Ordered checklist

1. [x] `types.ts` — model types, query/sort types, constants (extensions).
2. [x] `sqliteModule.ts` — runtime loader + ambient types for the
       node:sqlite subset (replaced the planned .d.ts with a duck-typed
       loader so no ambient module declaration is needed).
3. [x] `parser.ts` + `tests/libraryParser.test.cjs` (TDD: tests first).
4. [x] `store.ts` + `sqliteModule.ts` + `sqliteStore.ts` + `jsonStore.ts` +
       `tests/libraryStore.test.cjs` (shared suite runs both impls; sqlite
       suite skips gracefully when node:sqlite is unavailable).
5. [x] `scanner.ts` + `tests/libraryScanner.test.cjs` (tmpdir fixtures).
6. [x] `nfo.ts` + `tests/libraryNfo.test.cjs`.
7. [x] `ingest.ts` + `tests/libraryIngest.test.cjs` (end-to-end scan → store).
8. [x] Register nothing in handlers yet (pure data layer).

## Outcome

- Full suite: 92/92 pass (74 pre-existing + 51 new library assertions rolled
  into 18 new test cases + factory check). `npm run compile` clean.
- Environment note: electron binary was missing/broken in a fresh install;
  fixed by downloading the official zip from the npmmirror and extracting it
  into `node_modules/electron/dist` (no code impact).

## Validation commands

```
npm run compile
npm test
```

Both must pass with zero new warnings; existing 14 suites unaffected.

## Review gates

- After step 4: store interface reviewed against Phase 3 playback needs
  (getWatchState, setProgress, listContinueWatching, getSkipInfo/setSkipInfo).
- After step 7: full-suite run + cross-check with design.md.

## Rollback points

- Each step is an independent module; revert = delete module + its test file.
- Store factory falls back to JSON, so a broken sqliteStore cannot take the
  app down.
