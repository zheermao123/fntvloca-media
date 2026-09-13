const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { buildLibraryPlaylist, findSidecarSubtitles } = require('../dest/modules/library/playback');

const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function tmpDir() {
    return makeTmpDir('fntv-libplay-');
}

test('buildLibraryPlaylist builds a single movie entry with resume position', () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { item } = store.upsertItem({
            sourceId: source.id,
            kind: 'movie',
            title: 'Inception',
            year: 2010,
            filePath: 'D:/Movies/Inception.2010.1080p.mkv',
        });
        store.recordProgress(item.id, 600, 9000);

        const result = buildLibraryPlaylist(store, item.id);
        assert.ok(result);
        assert.equal(result.entries.length, 1);
        assert.equal(result.currentIndex, 0);
        const entry = result.entries[0];
        assert.equal(entry.itemGuid, item.id);
        assert.equal(entry.title, 'Inception');
        assert.equal(entry.tvTitle, '');
        assert.equal(entry.ts, 600);
        assert.deepEqual(entry.source, { kind: 'file', path: 'D:/Movies/Inception.2010.1080p.mkv' });
    } finally {
        store.close();
    }
});

test('buildLibraryPlaylist zeroes resume position for watched movies', () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Done', filePath: 'D:/x.mkv' });
        store.setWatched(item.id, true);
        const result = buildLibraryPlaylist(store, item.id);
        assert.equal(result.entries[0].ts, 0);
    } finally {
        store.close();
    }
});

test('buildLibraryPlaylist builds ordered episode list for a show', () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'got@2011', title: 'Game of Thrones', year: 2011 });
        const e2 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GoT', episodeTitle: 'The Kingsroad', season: 1, episode: 2, filePath: 'D:/e2.mkv' }).item;
        const e1 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GoT', season: 1, episode: 1, filePath: 'D:/e1.mkv' }).item;
        const e3 = store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'GoT', season: 1, episode: 3, filePath: 'D:/e3.mkv' }).item;
        store.recordProgress(e3.id, 100, 0);

        const result = buildLibraryPlaylist(store, e2.id);
        assert.ok(result);
        assert.equal(result.entries.length, 3);
        assert.equal(result.currentIndex, 1);
        assert.deepEqual(result.entries.map((e) => e.itemGuid), [e1.id, e2.id, e3.id]);
        assert.equal(result.entries[1].tvTitle, 'Game of Thrones');
        assert.equal(result.entries[1].episodeTitle ?? result.entries[1].title, 'The Kingsroad');
        assert.equal(result.entries[2].ts, 100);
        assert.equal(result.entries[0].ts, 0);
    } finally {
        store.close();
    }
});

test('buildLibraryPlaylist returns null for unknown item', () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        assert.equal(buildLibraryPlaylist(store, 'missing-id'), null);
    } finally {
        store.close();
    }
});

test('buildLibraryPlaylist resolves strm files to urls', () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Strm', filePath: 'D:/strm/movie.strm' });
        const reader = (filePath) => (filePath.endsWith('.strm') ? ' https://example.com/video.mkv \n' : null);
        const result = buildLibraryPlaylist(store, item.id, { readStrm: reader });
        assert.deepEqual(result.entries[0].source, { kind: 'url', url: 'https://example.com/video.mkv' });
    } finally {
        store.close();
    }
});

test('buildLibraryPlaylist falls back to file source when strm is unreadable', () => {
    const store = createJsonLibraryStore(path.join(tmpDir(), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'S' });
        const { item } = store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Strm', filePath: 'D:/strm/movie.strm' });
        const reader = () => '   ';
        const result = buildLibraryPlaylist(store, item.id, { readStrm: reader });
        assert.deepEqual(result.entries[0].source, { kind: 'file', path: 'D:/strm/movie.strm' });
    } finally {
        store.close();
    }
});

test('findSidecarSubtitles matches basename subtitles in the same directory', async () => {
    const dir = tmpDir();
    const video = path.join(dir, 'Movie.2010.1080p.mkv');
    fs.writeFileSync(video, 'v');
    fs.writeFileSync(path.join(dir, 'Movie.2010.1080p.chs.srt'), 's');
    fs.writeFileSync(path.join(dir, 'Movie.2010.1080p.ass'), 's');
    fs.writeFileSync(path.join(dir, 'Other.2011.srt'), 's');
    fs.writeFileSync(path.join(dir, 'cover.jpg'), 'i');

    const subs = await findSidecarSubtitles(video);
    const names = subs.map((p) => path.basename(p)).sort();
    assert.deepEqual(names, ['Movie.2010.1080p.ass', 'Movie.2010.1080p.chs.srt']);
});

test('findSidecarSubtitles returns empty list when nothing matches', async () => {
    const dir = tmpDir();
    const video = path.join(dir, 'Lonely.mkv');
    fs.writeFileSync(video, 'v');
    assert.deepEqual(await findSidecarSubtitles(video), []);
});
