# Phase 2 Implementation Plan

1. [ ] `tmdb.ts` — types, default axios transport, TmdbClient (search/detail).
2. [ ] `scraper.ts` — LibraryScraper pipeline + cache + match helpers.
3. [ ] `tests/libraryScraper.test.cjs` — fake transport suite covering search
       ranking, movie/show/episode scraping, poster caching, failure
       isolation, missing API key.
4. [ ] Full verify: `npm run compile` + `npm test`.

## Validation

```
npm run compile
npm test
```

## Rollback

Delete tmdb.ts/scraper.ts + test file; no existing module touched.
