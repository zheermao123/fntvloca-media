const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mapper = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'library.mapper.js'));

test('movie entry maps to a detail-routed card with watched status', () => {
    const card = mapper.mapCatalogEntry({
        type: 'movie',
        item: {
            id: 'item-1',
            kind: 'movie',
            title: 'Movie A',
            year: 2020,
            posterPath: 'E:\\cache\\a.jpg',
            overview: null,
            rating: null,
            runtime: 120,
        },
        watched: true,
        favorite: false,
        addedAt: 1,
        lastPlayedAt: 2,
    });
    assert.equal(card.kind, 'movie');
    assert.equal(card.title, 'Movie A');
    assert.equal(card.statusText, '已看');
    assert.equal(card.route, '/media/item-1');
    assert.deepEqual(card.badges, []);
});

test('season entry maps badges, status and season-query route', () => {
    const card = mapper.mapCatalogEntry({
        type: 'season',
        show: { id: 'show-1', title: 'Show A', year: 2021, posterPath: null, overview: null },
        season: 2,
        seasonCount: 3,
        episodeCount: 10,
        watchedCount: 4,
        favorite: true,
        progressPct: 55,
        resumeItemId: 'ep-1',
        addedAt: 1,
        lastPlayedAt: 2,
    });
    assert.equal(card.kind, 'season');
    assert.deepEqual(card.badges, ['第 2 季', '全 10 集']);
    assert.equal(card.statusText, '已看 4/10 · 观看中 55%');
    assert.equal(card.route, '/media/show-1?season=2');
});

test('single first season hides the season badge', () => {
    const card = mapper.mapCatalogEntry({
        type: 'season',
        show: { id: 'show-2', title: 'Show B', year: null, posterPath: null, overview: null },
        season: 1,
        seasonCount: 1,
        episodeCount: 12,
        watchedCount: 12,
        favorite: false,
        progressPct: 0,
        resumeItemId: 'ep-1',
        addedAt: 1,
        lastPlayedAt: 2,
    });
    assert.deepEqual(card.badges, ['全 12 集']);
    assert.equal(card.statusText, '已看完');
});

test('seasonStatusText covers unwatched / partial / in-progress', () => {
    assert.equal(mapper.seasonStatusText(0, 12, 0), '未看');
    assert.equal(mapper.seasonStatusText(3, 12, 0), '已看 3/12');
    assert.equal(mapper.seasonStatusText(12, 12, 0), '已看完');
    assert.equal(mapper.seasonStatusText(3, 12, 40), '已看 3/12 · 观看中 40%');
});

test('parseMediaRoute distinguishes season and movie detail routes', () => {
    assert.deepEqual(mapper.parseMediaRoute('show-1', '?season=3'), { kind: 'season', showId: 'show-1', season: 3 });
    assert.deepEqual(mapper.parseMediaRoute('item-1', ''), { kind: 'movie', itemId: 'item-1' });
    assert.deepEqual(mapper.parseMediaRoute('item-1', '?season=abc'), { kind: 'movie', itemId: 'item-1' });
});

test('route helpers encode ids and summarize caps category counts', () => {
    assert.equal(mapper.movieRoute('a b/c'), '/media/a%20b%2Fc');
    assert.equal(mapper.seasonRoute('show/1', 1), '/media/show%2F1?season=1');
    assert.deepEqual(mapper.summarizeCategory('movie', 600, 600), { category: 'movie', count: 600, capped: true });
    assert.deepEqual(mapper.summarizeCategory('movie', 599, 600), { category: 'movie', count: 599, capped: false });
});

test('library rows reuse card mapping with meta segments', () => {
    const rows = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'library', 'library.mapper.js'));
    const mapped = rows.mapLibraryRows([
        {
            type: 'season',
            show: { id: 'show-1', title: 'Show A', year: 2021, posterPath: null, overview: null },
            season: 2,
            seasonCount: 3,
            episodeCount: 10,
            watchedCount: 4,
            favorite: false,
            progressPct: 0,
            resumeItemId: 'ep-1',
            addedAt: 1,
            lastPlayedAt: 2,
        },
    ]);
    assert.equal(mapped.length, 1);
    assert.deepEqual(mapped[0].meta, ['第 2 季', '全 10 集', '2021']);
    assert.equal(mapped[0].statusText, '已看 4/10');
    assert.equal(mapped[0].route, '/media/show-1?season=2');
});
test('continue entries map to episode/movie routes with progress status', () => {
    const mapper = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'library.mapper.js'));
    const models = mapper.mapContinueEntries([
        {
            item: {
                id: 'ep-1',
                title: 'Show A',
                kind: 'episode',
                showId: 'show-1',
                season: 2,
                episode: 3,
                episodeTitle: 'E3',
                posterPath: null,
                year: 2020,
            },
            state: { positionTs: 500, durationTs: 1000, watched: false },
            showTitle: 'Show A',
            activityAt: 5,
        },
        {
            item: {
                id: 'movie-1',
                title: 'Movie A',
                kind: 'movie',
                showId: null,
                season: null,
                episode: null,
                episodeTitle: null,
                posterPath: null,
                year: 2019,
            },
            state: { positionTs: 0, durationTs: 0, watched: false },
            showTitle: null,
            activityAt: 4,
        },
    ]);
    assert.equal(models[0].route, '/media/show-1?season=2');
    assert.equal(models[0].statusText, '观看中 50%');
    assert.equal(models[0].progressPct, 50);
    assert.equal(models[0].subtitle, 'S02E03 · E3');
    assert.equal(models[1].route, '/media/movie-1');
    assert.equal(models[1].statusText, '继续观看');
});
