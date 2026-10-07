const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { migrateShowFavoritesToSeasons } = require('../dest/modules/library/favoriteMigration');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function newStore(prefix) {
    return createJsonLibraryStore(path.join(makeTmpDir(prefix), 'db.json'));
}

test('migrateShowFavoritesToSeasons converts legacy show favorites per season and removes legacy keys', () => {
    const store = newStore('fntv-favmigrate-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'GOT' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GOT', season: 1, episode: 1, filePath: 'e1' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GOT', season: 2, episode: 1, filePath: 'e2' });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GOT', season: 3, episode: 1, filePath: 'e3' });

        store.setFavorite('show', show.id, true);
        assert.deepEqual(store.listFavoriteKeys(), [`show:${show.id}`]);

        const migrated = migrateShowFavoritesToSeasons(store);
        assert.equal(migrated, 3, 'S1/S2/S3 各生成一条季收藏');
        assert.deepEqual(
            store.listFavoriteKeys().sort(),
            [`season:${show.id}:1`, `season:${show.id}:2`, `season:${show.id}:3`].sort()
        );
        assert.equal(store.getFavorite('show', show.id), false);
        assert.equal(store.getFavorite('season', `${show.id}:2`), true);

        // 幂等：二次运行为 0
        assert.equal(migrateShowFavoritesToSeasons(store), 0);
    } finally {
        store.close();
    }
});

test('migrateShowFavoritesToSeasons drops legacy keys for shows without items', () => {
    const store = newStore('fntv-favmigrate-empty-');
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'g', title: 'Empty' });
        store.setFavorite('show', show.id, true);

        const migrated = migrateShowFavoritesToSeasons(store);
        assert.equal(migrated, 0, '无集可迁移');
        assert.deepEqual(store.listFavoriteKeys(), [], '遗留键被清除');
    } finally {
        store.close();
    }
});
