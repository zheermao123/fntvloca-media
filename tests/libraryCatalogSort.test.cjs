const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createJsonLibraryStore, createLibraryStore } = require('../dest/modules/library/store');
const { buildCatalogPage } = require('../dest/modules/library/catalog');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

const CHINESE_TITLES = ['阿凡达', '北京遇上西雅图', '长津湖', '流浪地球', '满江红', '你好，李焕英', '战狼'];
// Unicode 码点序（与 SQLite BINARY/UTF-8 字节序一致）
const CHINESE_CODEPOINT_ORDER = [
    '你好，李焕英',
    '北京遇上西雅图',
    '战狼',
    '流浪地球',
    '满江红',
    '长津湖',
    '阿凡达',
];

function seedMovies(store, sourceId, titles) {
    for (const title of titles) {
        store.upsertItem({
            sourceId,
            kind: 'movie',
            title,
            year: 2020,
            filePath: `movies/${title}.mp4`,
        });
    }
}

function assertPagedEqualsFull(store, query, pageSize) {
    const full = buildCatalogPage(store, { ...query });
    const collected = [];
    let offset = 0;
    for (;;) {
        const page = buildCatalogPage(store, { ...query, limit: pageSize, offset });
        collected.push(...page.entries);
        if (!page.hasMore) {
            break;
        }
        offset += pageSize;
    }
    assert.equal(collected.length, full.total);
    assert.deepEqual(
        collected.map((entry) => (entry.type === 'movie' ? entry.item.title : entry.show.title)),
        full.entries.map((entry) => (entry.type === 'movie' ? entry.item.title : entry.show.title))
    );
    const keys = collected.map((entry) =>
        entry.type === 'movie' ? `movie:${entry.item.id}` : `season:${entry.show.id}:${entry.season}`
    );
    assert.equal(new Set(keys).size, keys.length, 'paged entries must not duplicate');
    return full;
}

test('json store: Chinese title sort is stable across pages (codepoint order)', () => {
    const store = createJsonLibraryStore(path.join(makeTmpDir('fntv-sort-json-'), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'M', config: { category: 'movie' } });
        seedMovies(store, source.id, CHINESE_TITLES);
        const full = assertPagedEqualsFull(store, { sort: 'title' }, 2);
        assert.deepEqual(
            full.entries.map((entry) => entry.item.title),
            CHINESE_CODEPOINT_ORDER
        );
        assertPagedEqualsFull(store, { sort: 'year' }, 3);
    } finally {
        store.close();
    }
});

test('json store: mixed movie/season pagination equals full merged order', () => {
    const store = createJsonLibraryStore(path.join(makeTmpDir('fntv-sort-mixed-'), 'db.json'));
    try {
        const movieSource = store.addSource({ type: 'local', name: 'M', config: { category: 'movie' } });
        seedMovies(store, movieSource.id, CHINESE_TITLES.slice(0, 4));
        const tvSource = store.addSource({ type: 'local', name: 'T', config: { category: 'tv' } });
        for (const title of CHINESE_TITLES.slice(4)) {
            const { show } = store.upsertShow({ sourceId: tvSource.id, groupKey: title, title, year: 2020 });
            store.upsertItem({
                sourceId: tvSource.id,
                kind: 'episode',
                showId: show.id,
                title,
                season: 1,
                episode: 1,
                filePath: `tv/${title}.mkv`,
            });
        }
        assertPagedEqualsFull(store, { sort: 'title' }, 2);
        assertPagedEqualsFull(store, { sort: 'year' }, 2);
    } finally {
        store.close();
    }
});

test('sqlite store: Chinese title/year pagination matches full order', (t) => {
    const dir = makeTmpDir('fntv-sort-sqlite-');
    let store;
    try {
        store = createLibraryStore(path.join(dir, 'library'));
    } catch (error) {
        t.skip('sqlite store unavailable: ' + error.message);
        return;
    }
    if (!store || !String(store.constructor.name).includes('Sqlite')) {
        store?.close?.();
        t.skip('node:sqlite backend unavailable');
        return;
    }
    try {
        const source = store.addSource({ type: 'local', name: 'M', config: { category: 'movie' } });
        seedMovies(store, source.id, CHINESE_TITLES);
        const fullTitle = assertPagedEqualsFull(store, { sort: 'title' }, 2);
        assert.deepEqual(
            fullTitle.entries.map((entry) => entry.item.title),
            CHINESE_CODEPOINT_ORDER
        );
        assertPagedEqualsFull(store, { sort: 'year' }, 2);
    } finally {
        store.close?.();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
