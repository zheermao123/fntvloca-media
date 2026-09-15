const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { scanLocalFolder } = require('../dest/modules/library/scanner');
const { ingestScanResult } = require('../dest/modules/library/ingest');
const { buildCatalog } = require('../dest/modules/library/catalog');
const {
    hashPrivacyPassword,
    verifyPrivacyPassword,
    isValidPrivacyPassword,
} = require('../dest/modules/library/privacy');
const { LibraryScraper } = require('../dest/modules/library/scraper');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function writeTree(root, files) {
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
}

async function ingestTree(store, prefix, config) {
    const root = makeTmpDir(prefix);
    return { root, config };
}

test('privacy password hashing (scrypt, salted, one-way)', () => {
    const hash = hashPrivacyPassword('secret123');
    assert.ok(hash.startsWith('scrypt$'));
    assert.equal(verifyPrivacyPassword('secret123', hash), true);
    assert.equal(verifyPrivacyPassword('wrong-pass', hash), false);
    assert.equal(verifyPrivacyPassword('', hash), false);
    assert.equal(verifyPrivacyPassword('secret123', null), false);
    assert.equal(verifyPrivacyPassword('secret123', 'garbage'), false);

    const hash2 = hashPrivacyPassword('secret123');
    assert.notEqual(hash, hash2, '随机盐应产生不同哈希');

    assert.equal(isValidPrivacyPassword('abcd'), true);
    assert.equal(isValidPrivacyPassword('abc'), false);
    assert.equal(isValidPrivacyPassword('   '), false);
    assert.equal(isValidPrivacyPassword(1234), false);
});

test('private source ingests strictly by folder (natural order, no extras filtering, local poster)', async () => {
    const root = makeTmpDir('fntv-privacy-ingest-');
    writeTree(root, {
        '剧集一/ep1.mkv': 'v',
        '剧集一/ep2.mkv': 'v',
        '剧集一/ep10.mkv': 'v',
        '剧集一/OP.mkv': 'v',
        '剧集一/子目录/特别篇.mkv': 'v',
        '剧集一/folder.jpg': 'img',
        '散装视频.mkv': 'v',
    });

    const store = createJsonLibraryStore(path.join(root, 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: '私密', config: { rootPath: root, private: '1' } });
        const scan = await scanLocalFolder({ rootPath: root });
        const summary = await ingestScanResult(store, source.id, scan);

        assert.equal(summary.added, 6, '5 个文件夹内视频 + 1 个根散文件');

        const shows = store.listShows(source.id);
        assert.equal(shows.length, 1);
        assert.equal(shows[0].title, '剧集一');

        const episodes = store.listItems({ showId: shows[0].id }).sort((a, b) => a.episode - b.episode);
        assert.equal(episodes.length, 5, '花絮/子目录视频同样入库（严格按文件夹）');
        const episodeOf = (title) => episodes.find((e) => e.episodeTitle === title)?.episode;
        assert.equal(episodes[0].episode, 1);
        assert.ok(episodeOf('ep1') < episodeOf('ep2'), 'ep1 应先于 ep2');
        assert.ok(episodeOf('ep2') < episodeOf('ep10'), '自然排序：ep10 在 ep2 之后');
        assert.ok(typeof episodeOf('OP') === 'number', '花絮文件同样入库');
        assert.ok(typeof episodeOf('特别篇') === 'number', '子目录视频同样入库');
        assert.ok(episodes.every((e) => e.season === 1));
        const ep1 = episodes.find((e) => e.episodeTitle === 'ep1');
        assert.ok(ep1 && typeof ep1.posterPath === 'string' && ep1.posterPath.endsWith('folder.jpg'), '本地 folder.jpg 作为封面');

        const loose = store.listItems({ sourceId: source.id, kind: 'movie' });
        assert.equal(loose.length, 1);
        assert.equal(loose[0].showId, null);
    } finally {
        store.close();
    }
});

test('private folder group key is namespaced (never merges with public show of same title)', async () => {
    const privateRoot = makeTmpDir('fntv-privacy-a-');
    const publicRoot = makeTmpDir('fntv-privacy-b-');
    writeTree(privateRoot, { '同名剧/01.mkv': 'v', '同名剧/02.mkv': 'v' });
    writeTree(publicRoot, { '同名剧/同名剧.S01E01.mkv': 'v' });

    const store = createJsonLibraryStore(path.join(makeTmpDir('fntv-privacy-db-'), 'db.json'));
    try {
        const privateSource = store.addSource({ type: 'local', name: '私密', config: { rootPath: privateRoot, private: '1' } });
        const publicSource = store.addSource({ type: 'local', name: '公开', config: { rootPath: publicRoot } });

        await ingestScanResult(store, privateSource.id, await scanLocalFolder({ rootPath: privateRoot }));
        await ingestScanResult(store, publicSource.id, await scanLocalFolder({ rootPath: publicRoot }));

        const privateShows = store.listShows(privateSource.id);
        const publicShows = store.listShows(publicSource.id);
        assert.equal(privateShows.length, 1);
        assert.equal(publicShows.length, 1);
        assert.notEqual(privateShows[0].id, publicShows[0].id, '同名剧不得共用剧集组');
        assert.equal(store.listItems({ showId: privateShows[0].id }).length, 2);
        assert.equal(store.listItems({ showId: publicShows[0].id }).length, 1);

        // 可见性隔离
        const publicCatalog = buildCatalog(store, {});
        assert.equal(publicCatalog.filter((e) => e.type === 'season' && e.show.sourceId === privateSource.id).length, 0, '默认目录不含隐私源');
        assert.equal(publicCatalog.filter((e) => e.type === 'season' && e.show.sourceId === publicSource.id).length, 1);

        const privateCatalog = buildCatalog(store, { visibility: 'private' });
        assert.equal(privateCatalog.length, 1);
        assert.equal(privateCatalog[0].show.sourceId, privateSource.id, '隐私目录仅含隐私源');

        const privacyWithCategory = buildCatalog(store, { visibility: 'private', category: 'movie' });
        assert.equal(privacyWithCategory.length, 0, '隐私视图不做内容类型筛选');
    } finally {
        store.close();
    }
});

test('scraper never touches private sources', async () => {
    const store = createJsonLibraryStore(path.join(makeTmpDir('fntv-privacy-scrape-'), 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: '私密', config: { rootPath: 'x', private: '1' } });
        store.upsertItem({ sourceId: source.id, kind: 'movie', title: 'Private Movie', filePath: 'p1' });
        const { show } = store.upsertShow({ sourceId: source.id, groupKey: 'private|s|folder', title: 'Private Show', year: null });
        store.upsertItem({ sourceId: source.id, kind: 'episode', showId: show.id, title: 'Private Show', season: 1, episode: 1, filePath: 'p2' });

        let calls = 0;
        const transport = {
            getJson: async () => {
                calls += 1;
                return { results: [] };
            },
            getBinary: async () => {
                calls += 1;
                return Buffer.from('x');
            },
        };
        const scraper = new LibraryScraper({ store, cacheDir: makeTmpDir('fntv-privacy-cache-'), transport, config: { apiKey: 'k' }, delayMs: 0 });

        const summary = await scraper.scrapeLibrary();
        assert.equal(summary.scraped, 0);
        assert.equal(summary.failed, 0);
        assert.equal(calls, 0, '隐私源不应发起任何 TMDB 请求');

        const items = store.listItems({ sourceId: source.id });
        const single = await scraper.scrapeItem(items[0].id);
        assert.equal(single.failed, 1);
        assert.equal(single.firstError, '隐私内容不参与刮削');
        assert.equal(calls, 0);

        await assert.rejects(() => scraper.applyShowMatch(show.id, 123), /隐私内容不参与刮削/);
        assert.equal(calls, 0);
    } finally {
        store.close();
    }
});
