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
        assert.equal(shows.length, 2, '第一层文件夹 + 源根散文件的"根剧集"');
        const folderShow = shows.find((s) => s.title === '剧集一');
        const rootShow = shows.find((s) => s.title === '私密');
        assert.ok(folderShow, '子文件夹 = 一部剧（标题=文件夹名）');
        assert.ok(rootShow, '源根散文件 = 以源名命名的剧集');

        const episodes = store.listItems({ showId: folderShow.id }).sort((a, b) => a.episode - b.episode);
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

        const rootEpisodes = store.listItems({ showId: rootShow.id });
        assert.equal(rootEpisodes.length, 1);
        assert.equal(rootEpisodes[0].kind, 'episode');
        assert.equal(rootEpisodes[0].episode, 1);
        assert.equal(rootEpisodes[0].episodeTitle, '散装视频');
        assert.equal(store.listItems({ sourceId: source.id, kind: 'movie' }).length, 0, '隐私源不再产生独立电影卡片');
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

test('flat privacy source becomes a single show named after the source', async () => {
    const root = makeTmpDir('fntv-privacy-flat-');
    writeTree(root, {
        '001 \u7247\u6bb5.mp4': 'v',
        '002 \u7247\u6bb5.mp4': 'v',
        '010 \u7247\u6bb5.mp4': 'v',
        'random.mp4': 'v',
    });
    const store = createJsonLibraryStore(path.join(root, 'db.json'));
    try {
        const source = store.addSource({ type: 'local', name: '\u6bcd\u72d7\u6b22\u6b22', config: { rootPath: root, private: '1' } });
        const scan = await scanLocalFolder({ rootPath: root });
        const summary = await ingestScanResult(store, source.id, scan);
        assert.equal(summary.added, 4);

        const shows = store.listShows(source.id);
        assert.equal(shows.length, 1, '\u6241\u5e73\u76ee\u5f55 = \u4e00\u90e8\u5267');
        assert.equal(shows[0].title, '\u6bcd\u72d7\u6b22\u6b22');

        const episodes = store.listItems({ showId: shows[0].id }).sort((a, b) => a.episode - b.episode);
        assert.equal(episodes.length, 4);
        assert.deepEqual(episodes.map((e) => e.episode), [1, 2, 3, 4]);
        const pos = (title) => episodes.find((e) => e.episodeTitle === title)?.episode;
        assert.ok(pos('001 \u7247\u6bb5') < pos('002 \u7247\u6bb5'));
        assert.ok(pos('002 \u7247\u6bb5') < pos('010 \u7247\u6bb5'), '\u81ea\u7136\u6392\u5e8f\uff1a010 \u5728 002 \u4e4b\u540e');
        assert.equal(store.listItems({ sourceId: source.id, kind: 'movie' }).length, 0);
    } finally {
        store.close();
    }
});

test('continue list is independent per visibility (privacy items must not crowd out public ones)', () => {
    const { takeContinueByVisibility } = require('../dest/modules/library/privacy');
    const entries = [];
    for (let i = 0; i < 20; i += 1) {
        entries.push({ item: { sourceId: 'priv-src', id: 'priv-' + i } });
    }
    for (let i = 0; i < 12; i += 1) {
        entries.push({ item: { sourceId: 'pub-src', id: 'pub-' + i } });
    }
    const privateIds = new Set(['priv-src']);

    const publicView = takeContinueByVisibility(entries, privateIds, false, 20);
    assert.equal(publicView.length, 12, '\u516c\u5f00\u6a21\u5f0f\u5e94\u62ff\u5230 12 \u6761\u516c\u5f00\u5019\u9009\uff08\u4e0d\u88ab\u9690\u79c1\u5019\u9009\u6324\u6389\uff09');
    assert.ok(publicView.every((e) => e.item.sourceId === 'pub-src'));

    const privateView = takeContinueByVisibility(entries, privateIds, true, 20);
    assert.equal(privateView.length, 20, '\u9690\u79c1\u6a21\u5f0f\u53d6\u6700\u8fd1 20 \u6761\u9690\u79c1\u5019\u9009');
    assert.ok(privateView.every((e) => e.item.sourceId === 'priv-src'));

    const limited = takeContinueByVisibility(entries, privateIds, false, 5);
    assert.equal(limited.length, 5, '\u9650\u91cf\u751f\u6548');
});
