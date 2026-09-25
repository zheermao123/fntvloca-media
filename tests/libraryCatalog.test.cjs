const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { buildCatalog } = require('../dest/modules/library/catalog');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function newStore(prefix) {
    return createJsonLibraryStore(path.join(makeTmpDir(prefix), 'db.json'));
}

test('buildCatalog merges episodes into show entries with resume pointer', () => {
    const store = newStore('fntv-catalog-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Movie A', year: 2010, filePath: 'm1' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g1', title: 'Show A', year: 2020 });
        const e1 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Show A', season: 1, episode: 1, filePath: 'e1' }).item;
        const e2 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Show A', season: 1, episode: 2, filePath: 'e2' }).item;
        store.updateShowMetadata(show.id, { posterPath: 'cache/show.jpg' });
        store.recordProgress(e1.id, 100, 1000);
        store.setWatched(e2.id, true);

        const entries = buildCatalog(store, {});
        assert.equal(entries.length, 2);
        const showEntry = entries.find((e) => e.type === 'season');
        assert.equal(showEntry.episodeCount, 2);
        assert.equal(showEntry.watchedCount, 1);
        assert.equal(showEntry.posterPath, 'cache/show.jpg');
        assert.equal(showEntry.resumeItemId, e1.id);

        // 观看筛选语义 A：未看=还有未看的集（剧集组出现）；已看=全部看完（无）
        const hasUnwatched = buildCatalog(store, { watched: false });
        assert.equal(hasUnwatched.filter((e) => e.type === 'season').length, 1);
        const allWatched = buildCatalog(store, { watched: true });
        assert.equal(allWatched.length, 0);
    } finally {
        store.close();
    }
});

test('buildCatalog falls back to episode poster when show has none', () => {
    const store = newStore('fntv-catalog2-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'B' });
        const ep = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'B', season: 1, episode: 1, filePath: 'x' }).item;
        store.updateItemMetadata(ep.id, { posterPath: 'cache/ep.jpg' });
        const entries = buildCatalog(store, {});
        assert.equal(entries[0].type, 'season');
        assert.equal(entries[0].posterPath, 'cache/ep.jpg');
    } finally {
        store.close();
    }
});

test('buildCatalog filters by kind/query and sorts by title', () => {
    const store = newStore('fntv-catalog3-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Alpha', filePath: 'm1' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'Beta Show' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Beta Show', season: 1, episode: 1, filePath: 'e1' });

        assert.equal(buildCatalog(store, { kind: 'movie' }).length, 1);
        const showsOnly = buildCatalog(store, { kind: 'episode' });
        assert.equal(showsOnly.length, 1);
        assert.equal(showsOnly[0].type, 'season');

        const searched = buildCatalog(store, { query: 'beta' });
        assert.equal(searched.length, 1);
        assert.equal(searched[0].type, 'season');

        const byTitle = buildCatalog(store, { sort: 'title' });
        assert.equal(byTitle[0].type, 'movie');
    } finally {
        store.close();
    }
});

test('movie catalog entries expose watched flag (same source as watched filter)', () => {
    const store = newStore('fntv-catalog-moviewatch-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const a = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Movie A', filePath: 'm1' }).item;
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Movie B', filePath: 'm2' });
        store.setWatched(a.id, true);

        const entries = buildCatalog(store, {});
        const movies = entries.filter((e) => e.type === 'movie');
        assert.equal(movies.length, 2);
        assert.equal(movies.find((e) => e.item.id === a.id).watched, true);
        assert.equal(movies.find((e) => e.item.title === 'Movie B').watched, false);

        const watchedOnly = buildCatalog(store, { watched: true });
        assert.equal(watchedOnly.length, 1);
        assert.equal(watchedOnly[0].type, 'movie');
        assert.equal(watchedOnly[0].watched, true);

        const unwatchedOnly = buildCatalog(store, { watched: false });
        assert.equal(unwatchedOnly.length, 1);
        assert.equal(unwatchedOnly[0].watched, false);
    } finally {
        store.close();
    }
});
