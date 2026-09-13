# Phase 2 Design

## Files

```
src/modules/library/tmdb.ts     transport-typed TMDB client
src/modules/library/scraper.ts  LibraryScraper pipeline
tests/libraryScraper.test.cjs   fake-transport suite
```

## Transport injection

```ts
export type TmdbTransport = {
    getJson(url: string): Promise<unknown>;
    getBinary(url: string): Promise<Buffer>;
};
```
Default transport wraps axios (getJson: JSON parse; getBinary: arraybuffer).
Tests inject fakes. `delayMs` between API calls via injectable `delay`
(default 250ms real, 0ms in tests). 404 responses resolve as `null` (detail
fetches tolerate missing data); other HTTP errors reject.

## URL construction

- api: `${apiBaseUrl}/search/movie?api_key=...&query=...&year=...&language=...`
- movie detail: `${apiBaseUrl}/movie/{id}`; tv: `/tv/{id}`;
  season: `/tv/{id}/season/{n}` (language applied → localized episode names).
- images: `${imageBaseUrl}/{size}{poster_path}` sizes: poster `w342`,
  backdrop `w780`, still `w185`.

## Matching

searchMovie/searchTv results sorted: exact-normalized title match first, then
year proximity (|Δyear| ascending, missing year → +∞), then popularity order as
returned. `pickBestResult` is a pure exported function for tests.

## Scrape flow (per target)

1. Movie item: `searchMovie(title, year)` → detail → updateItemMetadata
   `{ title(scraped), overview, rating, runtime, tmdbId, metadataSource:'tmdb' }`
   → poster/backdrop cached → posterPath/backdropPath.
2. Show (by showId, groupKey has title+year): `searchTv` → tv detail
   (overview, poster, backdrop, number_of_seasons) → updateShowMetadata →
   season details: for each episode item of the show update episodeTitle
   (localized name), still → posterPath; keep season/episode from filename.
3. Failure isolation: try/catch per item; `onProgress` after each.

## Cache key

`posterCachePath(cacheDir, kind, tmdbId, role)` →
`path.join(cacheDir, `${kind}_${tmdbId}_${role}.jpg`)`; if file exists, skip
download. Role ∈ poster|backdrop|still_{season}_{episode}.

## Config

`ScraperConfig { apiKey: string; apiBaseUrl?: string; imageBaseUrl?: string;
language?: string }` — assembled by callers (settings wiring lands in Phase 6).
Empty apiKey → throw `Error('TMDB API key is not configured')`.
