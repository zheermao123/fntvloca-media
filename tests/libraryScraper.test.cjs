const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { pickBestResult } = require('../dest/modules/library/tmdb');
const { LibraryScraper } = require('../dest/modules/library/scraper');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function tmpDir() {
    return makeTmpDir('fntv-scrape-');
}

const SEARCH_MOVIE = JSON.stringify({
    results: [
        { id: 27205, title: 'Inception', release_date: '2010-07-16', poster_path: '/poster.jpg', overview: 'dream', vote_average: 8.4 },
        { id: 999, title: 'Inception Fake', release_date: '2014-01-01', poster_path: null, overview: '', vote_average: 5 },
    ],
});

const MOVIE_DETAIL = JSON.stringify({
    id: 27205,
    title: '盗梦空间',
    overview: 'A thief who steals dreams.',
    runtime: 148,
    vote_average: 8.8,
    poster_path: '/poster.jpg',
    backdrop_path: '/backdrop.jpg',
});

const SEARCH_TV = JSON.stringify({
    results: [
        { id: 1399, name: 'Game of Thrones', first_air_date: '2011-04-17', poster_path: '/tvposter.jpg', overview: 'winter', vote_average: 9.2 },
    ],
});

const TV_DETAIL = JSON.stringify({
    id: 1399,
    name: '权力的游戏',
    overview: 'Nine families.',
    poster_path: '/tvposter.jpg',
    backdrop_path: '/tvbackdrop.jpg',
    number_of_seasons: 1,
    seasons: [{ season_number: 1 }],
});

const SEASON_DETAIL = JSON.stringify({
    episodes: [
        { episode_number: 1, name: 'Winter Is Coming', still_path: '/s1e1.jpg' },
        { episode_number: 2, name: 'The Kingsroad', still_path: null },
    ],
});

function makeTransport(overrides) {
    const calls = [];
    const routes = {
        '/search/movie': SEARCH_MOVIE,
        '/search/tv': SEARCH_TV,
        '/movie/27205': MOVIE_DETAIL,
        '/tv/1399/season/1': SEASON_DETAIL,
    };
    const transport = {
        calls,
        getJson: async (url) => {
            calls.push({ url, binary: false });
            for (const [needle, json] of Object.entries(routes)) {
                if (url.includes(needle)) {
                    if (overrides && overrides.throwFor && url.includes(overrides.throwFor)) {
                        throw new Error('transport failure');
                    }
                    return JSON.parse(json);
                }
            }
            if (url.includes('/tv/1399') && !url.includes('/season/')) {
                if (overrides && overrides.throwFor === '/tv/1399') {
                    throw new Error('transport failure');
                }
                return JSON.parse(TV_DETAIL);
            }
            if (overrides && overrides.throwFor && url.includes(overrides.throwFor)) {
                throw new Error('transport failure');
            }
            return { results: [] };
        },
        getBinary: async (url) => {
            calls.push({ url, binary: true });
            if (overrides && overrides.binaryFail) {
                throw new Error('image download failed');
            }
            return Buffer.from('fake-image-bytes');
        },
    };
    return transport;
}

function makeScraper(store, cacheDir, transport, extras) {
    return new LibraryScraper({
        store,
        cacheDir,
        transport,
        config: { apiKey: 'test-key' },
        delayMs: 0,
        ...extras,
    });
}

test('pickBestResult prefers exact title then year proximity', () => {
    const results = [
        { id: 999, title: 'Inception Fake', date: '2014-01-01', voteAverage: 5 },
        { id: 27205, title: 'Inception', date: '2010-07-16', voteAverage: 8.8 },
        { id: 123, title: 'The Inception', date: '2011-01-01', voteAverage: 6 },
    ];
    const best = pickBestResult(results, 'Inception', 2010);
    assert.equal(best.id, 27205);

    const noYear = pickBestResult(results, 'Inception', null);
    assert.equal(noYear.id, 27205);
});

test('scrapeLibrary fills movie metadata and caches poster locally', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Inception', year: 2010, filePath: 'p1' });
        const cacheDir = tmpDir();
        const transport = makeTransport();
        const scraper = makeScraper(store, cacheDir, transport);

        const summary = await scraper.scrapeLibrary();
        assert.equal(summary.scraped, 1);
        assert.equal(summary.failed, 0);

        const updated = store.getItem(item.id);
        assert.equal(updated.tmdbId, '27205');
        assert.equal(updated.metadataSource, 'tmdb');
        assert.equal(updated.overview, 'A thief who steals dreams.');
        assert.equal(updated.title, '盗梦空间');
        assert.equal(updated.runtime, 148);
        assert.equal(updated.rating, 8.8);
        assert.ok(updated.posterPath !== null);
        assert.ok(fs.existsSync(updated.posterPath));
        assert.ok(updated.backdropPath !== null);

        const imageCalls = transport.calls.filter((c) => c.binary).length;
        assert.equal(imageCalls, 2);
    } finally {
        store.close();
    }
});

test('scrapeLibrary skips already-scraped items on second run', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Inception', year: 2010, filePath: 'p1' });
        const transport = makeTransport();
        const scraper = makeScraper(store, tmpDir(), transport);

        await scraper.scrapeLibrary();
        const totalAfterFirst = transport.calls.length;
        const second = await scraper.scrapeLibrary();
        assert.equal(second.scraped, 0);
        assert.equal(transport.calls.length, totalAfterFirst);
    } finally {
        store.close();
    }
});

test('scrapeLibrary reuses cached posters across scrapes', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const a = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Inception', year: 2010, filePath: 'p1' }).item;
        const cacheDir = tmpDir();
        const transport = makeTransport();
        const scraper = makeScraper(store, cacheDir, transport);

        await scraper.scrapeLibrary();
        await scraper.scrapeItem(a.id);
        const binaryCalls = transport.calls.filter((c) => c.binary).length;
        assert.equal(binaryCalls, 2);
    } finally {
        store.close();
    }
});

test('scrapeLibrary scrapes shows and maps episode names and stills', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'got@2011', title: 'Game of Thrones', year: 2011 });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Game of Thrones', season: 1, episode: 1, filePath: 'e1' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Game of Thrones', season: 1, episode: 2, filePath: 'e2' });

        const cacheDir = tmpDir();
        const scraper = makeScraper(store, cacheDir, makeTransport());
        const summary = await scraper.scrapeLibrary();

        assert.equal(summary.scraped, 1);

        const updatedShow = store.getShow(show.id);
        assert.equal(updatedShow.tmdbId, '1399');
        assert.equal(updatedShow.title, '权力的游戏');
        assert.equal(updatedShow.overview, 'Nine families.');
        assert.ok(updatedShow.posterPath !== null);

        const episodes = store.listItems({ showId: show.id, sort: 'title' });
        const ep1 = episodes.find((e) => e.episode === 1);
        const ep2 = episodes.find((e) => e.episode === 2);
        assert.equal(ep1.episodeTitle, 'Winter Is Coming');
        assert.ok(ep1.posterPath !== null && fs.existsSync(ep1.posterPath));
        assert.equal(ep1.metadataSource, 'tmdb');
        assert.equal(ep2.episodeTitle, 'The Kingsroad');
        assert.equal(ep2.posterPath, null);
    } finally {
        store.close();
    }
});

test('scrapeLibrary isolates per-item failures and continues', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'AAA', year: 2001, filePath: 'p1' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Inception', year: 2010, filePath: 'p2' });

        const transport = makeTransport({ throwFor: 'query=AAA' });
        const scraper = makeScraper(store, tmpDir(), transport);

        const progress = [];
        const summary = await scraper.scrapeLibrary({
            onProgress: (p) => progress.push(p),
        });

        assert.equal(summary.scraped, 1);
        assert.equal(summary.failed, 1);
        assert.equal(progress.length, 2);
        assert.equal(progress[1].done, 2);
    } finally {
        store.close();
    }
});

test('scrapeLibrary counts items without search results as skipped', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Unknown Movie XYZ', year: 2020, filePath: 'p1' });

        const scraper = makeScraper(store, tmpDir(), makeTransport());
        const summary = await scraper.scrapeLibrary();
        assert.equal(summary.skipped, 1);
        assert.equal(summary.scraped, 0);
        const item = store.listItems({})[0];
        assert.equal(item.metadataSource, 'filename');
    } finally {
        store.close();
    }
});

test('scrapeLibrary rejects without api key before any network call', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'X', filePath: 'p' });
        const transport = makeTransport();
        const scraper = new LibraryScraper({
            store,
            cacheDir: tmpDir(),
            transport,
            config: { apiKey: '  ' },
            delayMs: 0,
        });
        await assert.rejects(() => scraper.scrapeLibrary(), /API key/);
        assert.equal(transport.calls.length, 0);
    } finally {
        store.close();
    }
});

test('applyMovieMatch forces a specific tmdb id', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Wrong Title', filePath: 'p' });
        const scraper = makeScraper(store, tmpDir(), makeTransport());

        await scraper.applyMovieMatch(item.id, 27205);
        const updated = store.getItem(item.id);
        assert.equal(updated.tmdbId, '27205');
        assert.equal(updated.metadataSource, 'tmdb');
        assert.equal(updated.title, '盗梦空间');
    } finally {
        store.close();
    }
});

test('applyShowMatch binds a show and refreshes episodes', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'GoT', year: 2011 });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GoT', season: 1, episode: 1, filePath: 'e1' });

        const scraper = makeScraper(store, tmpDir(), makeTransport());
        await scraper.applyShowMatch(show.id, 1399);

        const updatedShow = store.getShow(show.id);
        assert.equal(updatedShow.tmdbId, '1399');
        const ep = store.listItems({ showId: show.id })[0];
        assert.equal(ep.episodeTitle, 'Winter Is Coming');
    } finally {
        store.close();
    }
});

test('searchMovie and searchTv are exposed for manual matching', async () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const scraper = makeScraper(store, tmpDir(), makeTransport());
        const movies = await scraper.searchMovie('Inception', 2010);
        assert.equal(movies.length, 2);
        assert.equal(movies[0].id, 27205);
        assert.equal(movies[0].title, 'Inception');

        const shows = await scraper.searchTv('Game of Thrones');
        assert.equal(shows[0].id, 1399);
    } finally {
        store.close();
    }
});
