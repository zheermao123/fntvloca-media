const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { scanLocalFolder } = require('../dest/modules/library/scanner');
const { ingestScanResult } = require('../dest/modules/library/ingest');

const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function tmpDir() {
    return makeTmpDir('fntv-libingest-');
}

function writeTree(root, files) {
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
}

test('ingestScanResult creates movies, shows and episodes with metadata', async () => {
    const root = tmpDir();
    writeTree(root, {
        'Movies/Inception.2010.1080p.mkv': 'v',
        'Movies/Inception.2010.2160p.mkv': 'v',
        'Movies/sample-preview.mkv': 'v',
        'TV/Show A/Season 1/Show.A.S01E01.mkv': 'v',
        'TV/Show A/Season 1/Show.A.S01E02.mkv': 'v',
        'Movies/ignored.txt': 't',
    });

    const store = createJsonLibraryStore(path.join(root, 'library.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'Test', config: { rootPath: root } });
        const scan = await scanLocalFolder({ rootPath: root });
        const summary = await ingestScanResult(store, source.id, scan);

        assert.deepEqual(
            { added: summary.added, removed: summary.removed, skipped: summary.skipped },
            { added: 4, removed: 0, skipped: 1 }
        );

        const movies = store.listItems({ kind: 'movie', sourceId: source.id });
        assert.equal(movies.length, 2);
        for (const movie of movies) {
            assert.equal(movie.title, 'Inception');
            assert.equal(movie.year, 2010);
            assert.equal(movie.metadataSource, 'filename');
            assert.ok(['1080p', '2160p'].includes(movie.resolution));
        }

        const shows = store.listShows(source.id);
        assert.equal(shows.length, 1);
        assert.equal(shows[0].title, 'Show A');

        const episodes = store.listItems({ showId: shows[0].id });
        assert.equal(episodes.length, 2);
        for (const ep of episodes) {
            assert.equal(ep.kind, 'episode');
            assert.equal(ep.season, 1);
            assert.ok([1, 2].includes(ep.episode));
        }
    } finally {
        store.close();
    }
});

test('ingestScanResult is idempotent and preserves watch state across rescans', async () => {
    const root = tmpDir();
    writeTree(root, {
        'Movies/Heat.1995.mkv': 'v',
        'TV/Show/Show.S01E01.mkv': 'v',
    });

    const store = createJsonLibraryStore(path.join(root, 'library.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'Test' });
        const scan = await scanLocalFolder({ rootPath: root });
        const first = await ingestScanResult(store, source.id, scan);
        assert.equal(first.added, 2);

        const movie = store.listItems({ kind: 'movie' })[0];
        store.recordProgress(movie.id, 55, 120);

        const second = await ingestScanResult(store, source.id, scan);
        assert.equal(second.added, 0);
        assert.equal(second.updated, 2);
        assert.equal(second.removed, 0);
        assert.equal(store.getWatchState(movie.id).positionTs, 55);

        const shows = store.listShows(source.id);
        assert.equal(shows.length, 1);
    } finally {
        store.close();
    }
});

test('ingestScanResult removes vanished files and their watch states', async () => {
    const root = tmpDir();
    const videoPath = path.join(root, 'Movies', 'Gone.2007.mkv');
    writeTree(root, { 'Movies/Gone.2007.mkv': 'v', 'Movies/Stays.2008.mkv': 'v' });

    const store = createJsonLibraryStore(path.join(root, 'library.json'));
    try {
        const source = store.addSource({ type: 'local', name: 'Test' });
        const scan1 = await scanLocalFolder({ rootPath: root });
        await ingestScanResult(store, source.id, scan1);
        const gone = store.getItemByPath(source.id, videoPath);
        store.setWatched(gone.id, true);

        fs.rmSync(videoPath);
        const scan2 = await scanLocalFolder({ rootPath: root });
        const summary = await ingestScanResult(store, source.id, scan2);

        assert.equal(summary.removed, 1);
        assert.equal(store.getItem(gone.id), null);
        assert.equal(store.getWatchState(gone.id), null);
        assert.equal(store.countItems(source.id), 1);
    } finally {
        store.close();
    }
});
