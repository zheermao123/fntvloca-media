const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const routes = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'app', 'routes.js'));
const libraryMapper = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'library.mapper.js'));
const detailMapper = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'detail', 'detail.mapper.js'));
const { pickMovieVersions } = require('../dest/modules/library/movieVersions');

test('new collection routes are defined', () => {
    assert.equal(routes.ROUTES.allLibrary, '/library');
    assert.equal(routes.ROUTES.favorites, '/favorites');
    assert.equal(routes.ROUTES.continueWatching, '/continue');
    assert.equal(routes.ROUTES.settings, '/settings');
    assert.equal(routes.ROUTES.librarySearch('沙丘'), '/library?q=%E6%B2%99%E4%B8%98');
});

test('movie catalog cards keep favorite state and target', () => {
    const card = libraryMapper.mapCatalogEntry({
        type: 'movie',
        item: {
            id: 'movie-1',
            kind: 'movie',
            title: 'Movie',
            year: 2020,
            posterPath: null,
            overview: null,
            rating: null,
            runtime: null,
            resolution: '1080p',
        },
        watched: false,
        favorite: true,
        addedAt: 1,
        lastPlayedAt: 0,
    });
    assert.equal(card.favorite, true);
    assert.deepEqual(card.favoriteTarget, { type: 'movie', id: 'movie-1' });
    assert.deepEqual(card.badges, ['1080P']);
});

test('movie versions group only same source and same TMDB id', () => {
    const base = {
        kind: 'movie',
        showId: null,
        title: 'Dune',
        originalTitle: null,
        year: 2021,
        posterPath: null,
        backdropPath: null,
        overview: null,
        rating: null,
        runtime: null,
        sourceId: 'source-a',
        filePath: 'a.mkv',
        fileSize: 1,
        mtime: 1,
        resolution: '1080p',
        tmdbId: '438631',
        metadataSource: 'tmdb',
        season: null,
        episode: null,
        episodeTitle: null,
        addedAt: 1,
    };
    const versions = pickMovieVersions(
        { ...base, id: 'v1', filePath: 'v1.mkv' },
        [
            { ...base, id: 'v1', filePath: 'v1.mkv', resolution: '1080p' },
            { ...base, id: 'v2', filePath: 'v2.mkv', resolution: '2160p', fileSize: 3 },
            { ...base, id: 'v3', filePath: 'v3.mkv', tmdbId: 'other' },
            { ...base, id: 'v4', filePath: 'v4.mkv', sourceId: 'source-b' },
            { ...base, id: 'e1', kind: 'episode', filePath: 'e1.mkv' },
        ]
    );
    assert.deepEqual(versions.map((item) => item.id), ['v2', 'v1']);
});

test('movie without TMDB id does not fabricate versions', () => {
    const item = {
        id: 'm1',
        kind: 'movie',
        sourceId: 's1',
        tmdbId: null,
        filePath: 'm1.mkv',
        fileSize: 1,
        resolution: '1080p',
    };
    assert.deepEqual(pickMovieVersions(item, [item]).map((entry) => entry.id), ['m1']);
});

test('detail mapper maps real movie versions with file metadata', () => {
    const model = detailMapper.mapMovieDetail(
        {
            id: 'v1',
            kind: 'movie',
            title: 'Movie',
            year: 2021,
            posterPath: null,
            overview: null,
            rating: null,
            runtime: 120,
            filePath: 'Dune.2021.1080p.mkv',
            fileSize: 2048,
            resolution: '1080p',
            season: null,
            episode: null,
            episodeTitle: null,
        },
        {
            versions: [
                {
                    id: 'v2',
                    kind: 'movie',
                    title: 'Movie',
                    year: 2021,
                    posterPath: null,
                    overview: null,
                    rating: null,
                    runtime: 120,
                    filePath: 'Dune.2021.2160p.mkv',
                    fileSize: 4096,
                    resolution: '2160p',
                    season: null,
                    episode: null,
                    episodeTitle: null,
                },
            ],
        }
    );
    assert.equal(model.versions.length, 1);
    assert.equal(model.versions[0].fileName, 'Dune.2021.2160p.mkv');
    assert.equal(model.versions[0].sizeLabel, '4.0 KB');
    assert.equal(model.versions[0].resolution, '2160p');
});
