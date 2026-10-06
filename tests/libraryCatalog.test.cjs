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

test('season catalog entry exposes in-progress percent (consistent with resume/continue)', async () => {
    const store = newStore('fntv-catalog-progress-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'Show P' });
        const e1 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Show P', season: 1, episode: 1, filePath: 'e1' }).item;
        const e2 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Show P', season: 1, episode: 2, filePath: 'e2' }).item;

        let entry = buildCatalog(store, {}).find((e) => e.type === 'season');
        assert.equal(entry.progressPct, 0, '\u672a\u64ad\u653e\uff1a\u65e0\u8fdb\u5ea6');
        assert.equal(entry.resumeItemId, e1.id);

        store.recordProgress(e1.id, 600, 9000);
        await new Promise((r) => setTimeout(r, 5));
        entry = buildCatalog(store, {}).find((e) => e.type === 'season');
        assert.equal(entry.progressPct, 7, 'E1 \u8fdb\u884c\u4e2d 600/9000 = 7%');
        assert.equal(entry.resumeItemId, e1.id);
        assert.equal(entry.watchedCount, 0);

        store.recordProgress(e2.id, 4500, 9000);
        entry = buildCatalog(store, {}).find((e) => e.type === 'season');
        assert.equal(entry.progressPct, 50, '\u6700\u8fd1\u8fdb\u884c\u4e2d\u7684 E2 = 50%');
        assert.equal(entry.resumeItemId, e2.id, '\u7eed\u64ad\u96c6\u4e0e\u8fdb\u5ea6\u540c\u4e00\u96c6');

        store.setWatched(e1.id, true);
        store.setWatched(e2.id, true);
        entry = buildCatalog(store, {}).find((e) => e.type === 'season');
        assert.equal(entry.progressPct, 0, '\u5168\u770b\u5b8c\uff1a\u8fdb\u5ea6\u5f52 0\uff08\u5df2\u770b\u5b8c\uff09');
        assert.equal(entry.watchedCount, 2);
    } finally {
        store.close();
    }
});

test('catalog exposes favorite and filters by it (season inherits show favorite)', () => {
    const store = newStore('fntv-catalog-fav-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const m1 = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Fav Movie', filePath: 'm1' }).item;
        const m2 = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Plain Movie', filePath: 'm2' }).item;
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'Fav Show' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Fav Show', season: 1, episode: 1, filePath: 'e1' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Fav Show', season: 2, episode: 1, filePath: 'e2' });

        let entries = buildCatalog(store, {});
        assert.equal(entries.find((e) => e.type === 'movie' && e.item.id === m1.id).favorite, false);
        assert.ok(entries.filter((e) => e.type === 'season').every((e) => e.favorite === false));

        store.setFavorite('movie', m1.id, true);
        store.setFavorite('show', show.id, true);

        entries = buildCatalog(store, {});
        assert.equal(entries.find((e) => e.type === 'movie' && e.item.id === m1.id).favorite, true);
        assert.equal(entries.find((e) => e.type === 'movie' && e.item.id === m2.id).favorite, false);
        const seasons = entries.filter((e) => e.type === 'season');
        assert.equal(seasons.length, 2);
        assert.ok(seasons.every((e) => e.favorite === true), '\u6574\u5267\u6536\u85cf\uff1a\u6240\u6709\u5b63\u5361\u540c\u6b65');

        const favOnly = buildCatalog(store, { favorite: true });
        assert.equal(favOnly.length, 3, '1 \u90e8\u7535\u5f71 + 2 \u5f20\u5b63\u5361');
        assert.ok(favOnly.every((e) => e.favorite));

        const unfavOnly = buildCatalog(store, { favorite: false });
        assert.equal(unfavOnly.length, 1);
        assert.equal(unfavOnly[0].item.id, m2.id);
    } finally {
        store.close();
    }
});
