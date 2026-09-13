const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const storeModule = require('../dest/modules/library/store');
const { createLibraryStore, createJsonLibraryStore } = storeModule;
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function tmpDir() {
    return makeTmpDir('fntv-libstore-');
}

function runStoreSuite(label, openStore) {
    test(`[${label}] sources CRUD and cascade remove`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'Movies Disk' });
            assert.ok(source.id);
            assert.equal(source.type, 'local');
            assert.equal(source.name, 'Movies Disk');
            assert.equal(store.getSource(source.id).name, 'Movies Disk');

            store.updateSource({ ...source, name: 'Renamed', config: { rootPath: 'D:/Movies' } });
            const updated = store.getSource(source.id);
            assert.equal(updated.name, 'Renamed');
            assert.equal(updated.config.rootPath, 'D:/Movies');
            assert.equal(store.listSources().length, 1);

            const show = store.upsertShow({
                sourceId: source.id,
                groupKey: 'show@2010',
                title: 'Show',
            }).show;
            store.upsertItem({
                sourceId: source.id,
                kind: 'episode',
                showId: show.id,
                title: 'Show',
                season: 1,
                episode: 1,
                filePath: 'D:/Movies/Show.S01E01.mkv',
            });
            store.removeSource(source.id);
            assert.equal(store.getSource(source.id), null);
            assert.equal(store.listItems({ sourceId: source.id }).length, 0);
            assert.equal(store.listShows(source.id).length, 0);
        } finally {
            store.close();
        }
    });

    test(`[${label}] upsertItem is idempotent per (sourceId, filePath)`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const first = store.upsertItem({
                sourceId: source.id,
                kind: 'movie',
                title: 'Movie',
                year: 2010,
                filePath: 'D:/Movie.2010.mkv',
                fileSize: 100,
            });
            assert.equal(first.created, true);
            const second = store.upsertItem({
                sourceId: source.id,
                kind: 'movie',
                title: 'Movie Renamed',
                year: 2010,
                filePath: 'D:/Movie.2010.mkv',
                fileSize: 200,
            });
            assert.equal(second.created, false);
            assert.equal(second.item.id, first.item.id);
            assert.equal(second.item.addedAt, first.item.addedAt);
            assert.equal(second.item.title, 'Movie Renamed');
            assert.equal(second.item.fileSize, 200);
            assert.equal(store.getItemByPath(source.id, 'D:/Movie.2010.mkv').id, first.item.id);
        } finally {
            store.close();
        }
    });

    test(`[${label}] listItems filters, search, sort, pagination`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const show = store.upsertShow({ sourceId: source.id, groupKey: 'show@2010', title: 'Alpha Show', year: 2010 }).show;
            store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Batman', year: 2008, filePath: 'p1' });
            store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Heat', year: 1995, filePath: 'p2' });
            store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Alpha Show', season: 1, episode: 1, filePath: 'p3' });

            assert.equal(store.listItems({ kind: 'movie' }).length, 2);
            assert.equal(store.listItems({ sourceId: source.id }).length, 3);
            assert.equal(store.listItems({ showId: show.id }).length, 1);
            assert.equal(store.listItems({ query: 'heat' })[0].title, 'Heat');
            assert.equal(store.listItems({ query: 'ALPHA' })[0].title, 'Alpha Show');

            const byTitle = store.listItems({ kind: 'movie', sort: 'title' });
            assert.deepEqual(byTitle.map((i) => i.title), ['Batman', 'Heat']);
            const byYear = store.listItems({ kind: 'movie', sort: 'year' });
            assert.equal(byYear[0].title, 'Batman');

            const paged = store.listItems({ sort: 'title', limit: 2, offset: 2 });
            assert.equal(paged.length, 1);
            assert.equal(paged[0].title, 'Heat');

            assert.equal(store.countItems(), 3);
            assert.equal(store.countItems(source.id), 3);
        } finally {
            store.close();
        }
    });

    test(`[${label}] watched filter joins watch state`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const a = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'A', filePath: 'a' }).item;
            const b = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'B', filePath: 'b' }).item;
            store.setWatched(a.id, true);
            const watched = store.listItems({ watched: true });
            assert.equal(watched.length, 1);
            assert.equal(watched[0].id, a.id);
            const unwatched = store.listItems({ watched: false });
            assert.deepEqual(unwatched.map((i) => i.id), [b.id]);
        } finally {
            store.close();
        }
    });

    test(`[${label}] updateItemMetadata persists scraped fields`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Raw', filePath: 'x' });
            store.updateItemMetadata(item.id, {
                title: 'Pretty Title',
                overview: 'A plot',
                rating: 8.5,
                runtime: 120,
                posterPath: 'cache/poster.jpg',
                backdropPath: 'cache/backdrop.jpg',
                tmdbId: '1234',
                metadataSource: 'tmdb',
            });
            const updated = store.getItem(item.id);
            assert.equal(updated.title, 'Pretty Title');
            assert.equal(updated.overview, 'A plot');
            assert.equal(updated.rating, 8.5);
            assert.equal(updated.runtime, 120);
            assert.equal(updated.tmdbId, '1234');
            assert.equal(updated.metadataSource, 'tmdb');
        } finally {
            store.close();
        }
    });

    test(`[${label}] removeItemsExcept cleans items, watch states and orphan shows`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const show = store.upsertShow({ sourceId: source.id, groupKey: 'show@2010', title: 'Show' }).show;
            const ep1 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Show', season: 1, episode: 1, filePath: 'e1' }).item;
            const ep2 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Show', season: 1, episode: 2, filePath: 'e2' }).item;
            const movie = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'M', filePath: 'm' }).item;
            store.setWatched(ep1.id, true);
            store.recordProgress(movie.id, 60, 100);

            const removed = store.removeItemsExcept(source.id, [ep2.id]);
            assert.deepEqual(removed.sort(), [ep1.id, movie.id].sort());
            assert.equal(store.getItem(ep1.id), null);
            assert.equal(store.getItem(movie.id), null);
            assert.equal(store.getWatchState(ep1.id), null);
            assert.equal(store.getWatchState(movie.id), null);
            assert.equal(store.getItem(ep2.id).id, ep2.id);
            assert.equal(store.listShows(source.id).length, 1);

            store.removeItemsExcept(source.id, []);
            assert.equal(store.listShows(source.id).length, 0);
        } finally {
            store.close();
        }
    });

    test(`[${label}] watch state records progress and auto-watches near the end`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'M', filePath: 'm' });
            assert.equal(store.getWatchState(item.id), null);

            store.markPlaybackStart(item.id);
            store.recordProgress(item.id, 30, 100);
            let state = store.getWatchState(item.id);
            assert.equal(state.watched, false);
            assert.equal(state.positionTs, 30);
            assert.equal(state.durationTs, 100);
            assert.equal(state.playCount, 1);
            assert.ok(state.lastPlayedAt > 0);

            store.recordProgress(item.id, 96, 100);
            state = store.getWatchState(item.id);
            assert.equal(state.watched, true);

            store.setWatched(item.id, false);
            state = store.getWatchState(item.id);
            assert.equal(state.watched, false);
            assert.equal(state.positionTs, 0);
        } finally {
            store.close();
        }
    });

    test(`[${label}] continue watching and history lists`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            const source = store.addSource({ type: 'local', name: 'S' });
            const items = ['a', 'b', 'c', 'd'].map((p) =>
                store.upsertItem({ sourceId: source.id, kind: 'movie', title: p.toUpperCase(), filePath: p }).item
            );
            store.recordProgress(items[0].id, 50, 100);
            store.recordProgress(items[1].id, 99, 100);
            store.setWatched(items[2].id, true);
            store.recordProgress(items[3].id, 0, 0);

            const continuing = store.listContinueWatching();
            assert.equal(continuing.length, 1);
            assert.equal(continuing[0].item.id, items[0].id);
            assert.equal(continuing[0].state.positionTs, 50);

            store.recordProgress(items[3].id, 40, 100);
            const history = store.listHistory(2);
            assert.equal(history.length, 2);
            assert.ok(history[0].state.lastPlayedAt >= history[1].state.lastPlayedAt);
        } finally {
            store.close();
        }
    });

    test(`[${label}] skip info set/get/remove`, () => {
        const dir = tmpDir();
        const store = openStore(dir);
        try {
            assert.equal(store.getSkipInfo('show-1'), null);
            store.setSkipInfo('show-1', 30, 90);
            assert.deepEqual(store.getSkipInfo('show-1'), { key: 'show-1', skipStart: 30, skipEnd: 90 });
            store.setSkipInfo('show-1', 25, 95);
            assert.deepEqual(store.getSkipInfo('show-1'), { key: 'show-1', skipStart: 25, skipEnd: 95 });
            store.removeSkipInfo('show-1');
            assert.equal(store.getSkipInfo('show-1'), null);
        } finally {
            store.close();
        }
    });

    test(`[${label}] persists data across close and reopen`, () => {
        const dir = tmpDir();
        const first = openStore(dir);
        const source = first.addSource({ type: 'local', name: 'Persist', config: { rootPath: 'X:/' } });
        const { item } = first.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Deep', filePath: 'X:/deep.mkv' });
        first.recordProgress(item.id, 42, 100);
        first.setSkipInfo('k', 10, 20);
        first.close();

        const second = openStore(dir);
        try {
            const loaded = second.getItem(item.id);
            assert.equal(loaded.title, 'Deep');
            assert.equal(second.getSource(source.id).name, 'Persist');
            assert.equal(second.getWatchState(item.id).positionTs, 42);
            assert.equal(second.getSkipInfo('k').skipStart, 10);
        } finally {
            second.close();
        }
    });
}

test('store factory picks an available implementation', () => {
    const dir = tmpDir();
    const store = createLibraryStore(dir);
    try {
        assert.equal(typeof store.upsertItem, 'function');
        assert.equal(typeof store.listItems, 'function');
    } finally {
        store.close();
    }
});

runStoreSuite('json', (dir) => createJsonLibraryStore(path.join(dir, 'library.json')));

let sqliteAvailable = false;
try {
    require('node:sqlite');
    sqliteAvailable = true;
} catch {
    sqliteAvailable = false;
}
if (sqliteAvailable) {
    runStoreSuite('auto-sqlite', (dir) => createLibraryStore(dir));
} else {
    test('node:sqlite unavailable; sqlite suite skipped', () => {
        assert.equal(sqliteAvailable, false);
    });
}
