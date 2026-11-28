const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mapper = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'library.mapper.js'));

test('catalog cards expose resolution badges and season progress', () => {
    const movie = mapper.mapCatalogEntry({
        type: 'movie',
        item: {
            id: 'm1',
            kind: 'movie',
            title: '4K Movie',
            year: null,
            posterPath: null,
            overview: null,
            rating: null,
            runtime: null,
            resolution: '2160p',
        },
        watched: false,
        favorite: false,
        addedAt: 1,
        lastPlayedAt: 0,
    });
    assert.deepEqual(movie.badges, ['4K']);

    const season = mapper.mapCatalogEntry({
        type: 'season',
        show: { id: 's1', title: 'Show', year: null, posterPath: null, overview: null },
        season: 1,
        seasonCount: 1,
        episodeCount: 8,
        watchedCount: 2,
        favorite: false,
        progressPct: 40,
        resolution: '1080p',
        resumeItemId: 'e2',
        addedAt: 1,
        lastPlayedAt: 2,
    });
    assert.ok(season.badges.includes('1080P'));
    assert.equal(season.progressPct, 40);
});

test('history entries map to season/movie routes and progress', () => {
    const models = mapper.mapHistoryEntries([
        {
            itemId: 'ep9',
            title: 'Show A',
            kind: 'episode',
            showId: 'show-9',
            season: 3,
            episode: 2,
            episodeTitle: 'E2',
            posterPath: null,
            year: 2024,
            watched: false,
            positionTs: 250,
            durationTs: 1000,
            progressPct: 25,
            lastPlayedAt: 10,
        },
        {
            itemId: 'mv9',
            title: 'Movie B',
            kind: 'movie',
            showId: null,
            season: null,
            episode: null,
            episodeTitle: null,
            posterPath: null,
            year: null,
            watched: true,
            positionTs: 0,
            durationTs: 0,
            progressPct: 0,
            lastPlayedAt: 9,
        },
    ]);
    assert.equal(models[0].route, '/media/show-9?season=3');
    assert.equal(models[0].subtitle, 'S03E02 · E2');
    assert.equal(models[0].statusText, '观看中 25%');
    assert.equal(models[0].progressPct, 25);
    assert.equal(models[1].route, '/media/mv9');
    assert.equal(models[1].statusText, '已看');
});
