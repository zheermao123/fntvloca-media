const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { guessSourceCategory, categoryOfSource, normalizeCategory } = require('../dest/modules/library/sourceCategory');
const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { buildCatalog } = require('../dest/modules/library/catalog');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

test('guessSourceCategory mirrors fnOS 内容类型 by name/path', () => {
    assert.equal(guessSourceCategory('动漫', 'D:\\【动漫】'), 'anime');
    assert.equal(guessSourceCategory('', 'D:\\【动漫】'), 'anime');
    assert.equal(guessSourceCategory('Anime Movies'), 'anime');
    assert.equal(guessSourceCategory('电影', 'D:\\【电影】'), 'movie');
    assert.equal(guessSourceCategory('', 'D:\\【电影】'), 'movie');
    assert.equal(guessSourceCategory('国产剧', 'D:\\【国产剧】'), 'tv');
    assert.equal(guessSourceCategory('TV Shows'), 'tv');
    assert.equal(guessSourceCategory('我的收藏'), 'other');
});

test('categoryOfSource prefers explicit config and falls back to guess', () => {
    assert.equal(categoryOfSource({ name: '动漫', config: { rootPath: 'D:\\【动漫】' } }), 'anime');
    assert.equal(categoryOfSource({ name: '动漫', config: { category: 'movie' } }), 'movie');
    assert.equal(categoryOfSource({ name: '片库', config: { category: 'bogus' } }), 'movie');
    assert.equal(normalizeCategory('anime'), 'anime');
    assert.equal(normalizeCategory('bogus'), null);
});

test('buildCatalog filters entries by source content category', () => {
    const store = createJsonLibraryStore(path.join(makeTmpDir('fntv-category-'), 'db.json'));
    try {
        const movies = store.addSource({ type: 'local', name: '电影', config: { category: 'movie' } });
        const anime = store.addSource({ type: 'local', name: '动漫', config: { category: 'anime' } });
        const tv = store.addSource({ type: 'local', name: '国产剧' }); // 未标注 → 按名称猜测为 tv

        store.upsertItem({ sourceId: movies.id, kind: 'movie', title: 'Movie A', filePath: 'm1' });

        const { show: animeShow } = store.upsertShow({ sourceId: anime.id, groupKey: 'anime-1', title: 'Anime A', year: 2020 });
        store.upsertItem({ sourceId: anime.id, kind: 'episode', showId: animeShow.id, title: 'Anime A', season: 1, episode: 1, filePath: 'a1' });
        store.upsertItem({ sourceId: anime.id, kind: 'movie', title: 'Anime Movie', filePath: 'am1' });

        const { show: tvShow } = store.upsertShow({ sourceId: tv.id, groupKey: 'tv-1', title: 'TV A', year: 2021 });
        store.upsertItem({ sourceId: tv.id, kind: 'episode', showId: tvShow.id, title: 'TV A', season: 1, episode: 1, filePath: 't1' });

        assert.equal(buildCatalog(store, {}).length, 4, 'no category filter returns everything');
        assert.equal(buildCatalog(store, { category: 'movie' }).length, 1);
        assert.equal(buildCatalog(store, { category: 'anime' }).length, 2, 'anime source includes its shows and movies');
        assert.equal(buildCatalog(store, { category: 'tv' }).length, 1);
        assert.equal(buildCatalog(store, { category: 'other' }).length, 0);
    } finally {
        store.close();
    }
});
