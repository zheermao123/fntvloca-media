const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { clampHistoryLimit, toHistoryItemView, HISTORY_DEFAULT_LIMIT, HISTORY_MAX_LIMIT } = require('../dest/modules/library/historyView.js');
const { createJsonLibraryStore } = require('../dest/modules/library/store.js');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

test('history limit is clamped to 1..50 with default 20', () => {
    assert.equal(clampHistoryLimit(undefined), HISTORY_DEFAULT_LIMIT);
    assert.equal(clampHistoryLimit(0), 1);
    assert.equal(clampHistoryLimit(-5), 1);
    assert.equal(clampHistoryLimit(1), 1);
    assert.equal(clampHistoryLimit(20), 20);
    assert.equal(clampHistoryLimit(20.9), 20);
    assert.equal(clampHistoryLimit(50), HISTORY_MAX_LIMIT);
    assert.equal(clampHistoryLimit(51), HISTORY_MAX_LIMIT);
    assert.equal(clampHistoryLimit(Number.NaN), HISTORY_DEFAULT_LIMIT);
    assert.equal(clampHistoryLimit('abc'), HISTORY_DEFAULT_LIMIT);
});

test('history item view exposes only whitelisted renderer fields', () => {
    const entry = {
        item: {
            id: 'item-1',
            sourceId: 'src-1',
            kind: 'episode',
            showId: 'show-1',
            title: 'Show',
            originalTitle: 'Show Original',
            year: 2020,
            season: 2,
            episode: 3,
            episodeTitle: 'Ep',
            filePath: 'E:\\secret\\path.mkv',
            fileSize: 123,
            mtime: 456,
            resolution: '1080p',
            overview: null,
            rating: null,
            runtime: null,
            posterPath: 'cache/p.jpg',
            backdropPath: null,
            tmdbId: null,
            metadataSource: 'filename',
            addedAt: 1,
        },
        state: {
            itemId: 'item-1',
            watched: false,
            positionTs: 500,
            durationTs: 1000,
            lastPlayedAt: 99,
            playCount: 1,
        },
    };
    const view = toHistoryItemView(entry);
    assert.equal(view.itemId, 'item-1');
    assert.equal(view.progressPct, 50);
    assert.equal(view.watched, false);
    assert.equal(view.lastPlayedAt, 99);
    for (const leaked of ['filePath', 'sourceId', 'mtime', 'fileSize', 'originalTitle', 'resolution', 'tmdbId', 'metadataSource', 'addedAt']) {
        assert.ok(!(leaked in view), `DTO 不得包含内部字段: ${leaked}`);
    }

    const zeroDuration = toHistoryItemView({
        item: { ...entry.item },
        state: { ...entry.state, positionTs: 0, durationTs: 0 },
    });
    assert.equal(zeroDuration.progressPct, 0);

    const clamped = toHistoryItemView({
        item: { ...entry.item },
        state: { ...entry.state, positionTs: 1200, durationTs: 1000 },
    });
    assert.equal(clamped.progressPct, 100);
});

test('history list is newest-first and empty history returns an empty array', async (t) => {
    const store = createJsonLibraryStore(path.join(makeTmpDir('fntv-history-'), 'db.json'));
    try {
        assert.deepEqual(store.listHistory(20), []);
        const source = store.addSource({ type: 'local', name: 'S' });
        const a = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'A', filePath: 'a' }).item;
        const b = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'B', filePath: 'b' }).item;
        store.recordProgress(a.id, 10, 100);
        await new Promise((resolve) => setTimeout(resolve, 5));
        store.recordProgress(b.id, 20, 100);
        const history = store.listHistory(1);
        assert.equal(history.length, 1);
        assert.equal(history[0].item.id, b.id, '按最近播放倒序 + limit 生效');
    } finally {
        store.close();
    }
});
