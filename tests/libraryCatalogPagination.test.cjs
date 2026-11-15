const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { buildCatalogPage } = require('../dest/modules/library/catalog');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function newStore(prefix) {
    return createJsonLibraryStore(path.join(makeTmpDir(prefix), 'db.json'));
}

function seedMovies(store, sourceId, titles) {
    return titles.map((title) =>
        store.upsertItem({ sourceId, kind: 'movie', title, year: 2020, filePath: `movies/${title}.mp4` }).item
    );
}

test('catalog pages expose accurate total, offset and stable non-overlapping slices', () => {
    const store = newStore('fntv-page-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        seedMovies(store, source.id, ['Charlie', 'Alpha', 'Echo', 'Bravo', 'Golf', 'Delta', 'Foxtrot']);

        const first = buildCatalogPage(store, { sort: 'title', limit: 3, offset: 0 });
        const second = buildCatalogPage(store, { sort: 'title', limit: 3, offset: 3 });
        const third = buildCatalogPage(store, { sort: 'title', limit: 3, offset: 6 });

        assert.equal(first.total, 7);
        assert.equal(first.hasMore, true);
        assert.equal(second.total, 7);
        assert.equal(second.hasMore, true);
        assert.equal(third.total, 7);
        assert.equal(third.hasMore, false);

        const titles = [...first.entries, ...second.entries, ...third.entries].map((entry) => entry.item.title);
        assert.deepEqual(titles, ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf']);
        assert.equal(new Set(titles).size, 7);

        const beyond = buildCatalogPage(store, { limit: 3, offset: 99 });
        assert.deepEqual(beyond.entries, []);
        assert.equal(beyond.hasMore, false);
    } finally {
        store.close();
    }
});

test('filters and search totals match the full filtered set', () => {
    const store = newStore('fntv-page-filter-');
    try {
        const source = store.addSource({ type: 'local', name: 'S', config: { category: 'movie' } });
        const movies = seedMovies(store, source.id, ['Alpha', 'Beta', 'Gamma', 'Delta']);
        store.setWatched(movies[0].id, true);
        store.setWatched(movies[1].id, true);
        store.setFavorite('movie', movies[2].id, true);

        const watched = buildCatalogPage(store, { watched: true, limit: 1 });
        assert.equal(watched.total, 2);
        assert.equal(watched.hasMore, true);

        const favorites = buildCatalogPage(store, { favorite: true, limit: 10 });
        assert.equal(favorites.total, 1);
        assert.equal(favorites.entries.length, 1);

        const searched = buildCatalogPage(store, { query: 'DELTA', limit: 10 });
        assert.equal(searched.total, 1);
        assert.equal(searched.entries[0].item.title, 'Delta');
    } finally {
        store.close();
    }
});

test('public and private visibility totals are isolated', () => {
    const store = newStore('fntv-page-privacy-');
    try {
        const publicSource = store.addSource({ type: 'local', name: 'Public' });
        const privateSource = store.addSource({ type: 'local', name: 'Private', config: { private: '1' } });
        seedMovies(store, publicSource.id, ['Public A', 'Public B', 'Public C']);
        seedMovies(store, privateSource.id, ['Private A', 'Private B']);

        const publicPage = buildCatalogPage(store, { visibility: 'public', limit: 10 });
        const privatePage = buildCatalogPage(store, { visibility: 'private', limit: 1 });

        assert.equal(publicPage.total, 3);
        assert.equal(privatePage.total, 2);
        assert.equal(privatePage.hasMore, true);
        assert.ok(publicPage.entries.every((entry) => entry.item.title.startsWith('Public')));
        assert.ok(privatePage.entries.every((entry) => entry.item.title.startsWith('Private')));
    } finally {
        store.close();
    }
});

test('season entries paginate by show/season cards with totals', () => {
    const store = newStore('fntv-page-seasons-');
    try {
        const source = store.addSource({ type: 'local', name: 'TV', config: { category: 'tv' } });
        for (let s = 0; s < 3; s += 1) {
            const { show } = store.upsertShow({ sourceId: source.id, groupKey: `g${s}`, title: `Show ${s}` });
            for (let e = 1; e <= 2; e += 1) {
                store.upsertItem({
                    sourceId: source.id,
                    kind: 'episode',
                    showId: show.id,
                    title: `Show ${s}`,
                    season: 1,
                    episode: e,
                    filePath: `s${s}/e${e}.mkv`,
                });
            }
        }

        const page = buildCatalogPage(store, { kind: 'episode', limit: 2 });
        assert.equal(page.total, 3);
        assert.equal(page.entries.length, 2);
        assert.equal(page.entries.every((entry) => entry.type === 'season'), true);
        assert.equal(page.hasMore, true);

        const rest = buildCatalogPage(store, { kind: 'episode', limit: 2, offset: 2 });
        assert.equal(rest.entries.length, 1);
        assert.equal(rest.hasMore, false);
    } finally {
        store.close();
    }
});

test('category filters partition totals by source content type', () => {
    const store = newStore('fntv-page-category-');
    try {
        const movieSource = store.addSource({ type: 'local', name: 'M', config: { category: 'movie' } });
        seedMovies(store, movieSource.id, ['M1', 'M2']);
        const tvSource = store.addSource({ type: 'local', name: 'T', config: { category: 'tv' } });
        for (let s = 0; s < 2; s += 1) {
            const { show } = store.upsertShow({ sourceId: tvSource.id, groupKey: `g${s}`, title: `T${s}` });
            store.upsertItem({
                sourceId: tvSource.id,
                kind: 'episode',
                showId: show.id,
                title: `T${s}`,
                season: 1,
                episode: 1,
                filePath: `t${s}.mkv`,
            });
        }

        assert.equal(buildCatalogPage(store, { category: 'movie' }).total, 2);
        assert.equal(buildCatalogPage(store, { category: 'tv' }).total, 2);
        assert.equal(buildCatalogPage(store, { category: 'anime' }).total, 0);
        assert.equal(buildCatalogPage(store, {}).total, 4);
    } finally {
        store.close();
    }
});