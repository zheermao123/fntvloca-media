const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveFolderEpisodeContext, parseSeasonDir, isExtraMaterial } = require('../dest/modules/library/episodeContext');
const { parseVideoName } = require('../dest/modules/library/parser');
const { createJsonLibraryStore } = require('../dest/modules/library/store');
const { scanLocalFolder } = require('../dest/modules/library/scanner');
const { ingestScanResult } = require('../dest/modules/library/ingest');

const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

// 真实世界命名语料：目录语义 + 文件名语法（Jellyfin 规范 / 常见压制组 / 中文剧集 / 电影）
const CTX_CORPUS = [
    {
        name: 'DBD-Raws 方括号命名 + S1 季目录',
        dirs: ['怪兽8号', 'S1'],
        file: '[DBD-Raws][Kaijuu 8 Gou][01][1080P][BDRip][HEVC-10bit][FLACx2].mkv',
        count: 12,
        expect: { showTitle: '怪兽8号', season: 1, episode: 1 },
    },
    {
        name: 'YYDM 方括号命名 + 年份目录',
        dirs: ['钢之炼金术师 (2003)'],
        file: '[YYDM-11FANS][Fullmetal Alchemist][51][BDRIP][720P][X264-10bit_AAC][4B4308C9].mp4',
        count: 59,
        expect: { showTitle: '钢之炼金术师', year: 2003, season: 1, episode: 51 },
    },
    {
        name: '绝对集号取最右数字（怪獣8号 第二季 13）',
        dirs: ['怪兽8号', 'S2'],
        file: 'ANi_怪獣_8_號_第二季_13_1080PBahaWEB_DLAAC_AVCCHT.mp4',
        count: 11,
        expect: { showTitle: '怪兽8号', season: 2, episode: 13 },
    },
    {
        name: 'Season N 带副标题',
        dirs: ['一人之下', 'Season 2 罗天大醮篇'],
        file: '一人之下 S02E01.mkv',
        count: 24,
        expect: { showTitle: '一人之下', season: 2, episode: 1 },
    },
    {
        name: '季目录之下的版本目录透明',
        dirs: ['一人之下', 'Season 6', '【4K.60帧收藏版】'],
        file: '一人之下 S06E21.2160p.WEB-DL.H265.mp4',
        count: 5,
        expect: { showTitle: '一人之下', season: 6, episode: 21 },
    },
    {
        name: '版本目录里的分卷子目录同样透明',
        dirs: ['灵笼', '灵笼 S02 4K（2025）', '第01-13集'],
        file: '07 4K.mp4',
        count: 14,
        expect: { showTitle: '灵笼', season: 2, episode: 7 },
    },
    {
        name: 'Jellyfin 官方多集文件 S01E01-E02',
        dirs: ['Series (2010)', 'Season 01'],
        file: 'Series (2010) S01E01-E02.mkv',
        count: 10,
        expect: { showTitle: 'Series', year: 2010, season: 1, episode: 1 },
    },
    {
        name: '无季目录平铺（剧目录内 SxxEyy）',
        dirs: ['Series (2018)'],
        file: 'Series (2018) S02E03.mkv',
        count: 20,
        expect: { showTitle: 'Series', year: 2018, season: 2, episode: 3 },
    },
    {
        name: '1x01 形式',
        dirs: ['Show'],
        file: 'Show - 1x01 - Pilot.mkv',
        count: 12,
        expect: { showTitle: 'Show', season: 1, episode: 1 },
    },
    {
        name: '中文 第05集',
        dirs: ['剧名'],
        file: '剧名.第05集.mkv',
        count: 30,
        expect: { showTitle: '剧名', episode: 5 },
    },
    {
        name: 'EP46 + 发行噪音',
        dirs: ['大明王朝1566（2007）'],
        file: '大明王朝1566.2007.EP46.HD1080P.X264.AAC.Mandarin.CHS.BDE4.mp4',
        count: 46,
        expect: { showTitle: '大明王朝1566', year: 2007, episode: 46 },
    },
    {
        name: 'Special 目录 → 第 0 季',
        dirs: ['排球少年', 'Specials'],
        file: '排球少年 - S00E02 - VS“不及格”.mkv',
        count: 5,
        expect: { showTitle: '排球少年', season: 0, episode: 2 },
    },
    {
        name: '中文季目录（第一季）',
        dirs: ['庆余年', '第一季'],
        file: '01.mkv',
        count: 46,
        expect: { showTitle: '庆余年', season: 1, episode: 1 },
    },
    {
        name: '带剧名与年份的季目录不应把年份算进剧标识',
        dirs: ['剑来(2024)第2季[tmdbid-259537](1)'],
        file: '剑来.Sword.of.Coming.S02E01.2024.2160p.WEB-DL.H265.AAC-GWEB.mp4',
        count: 27,
        expect: { showTitle: '剑来', year: null, season: 2, episode: 1, tmdbId: 259537 },
    },
];

test('naming corpus: folder context across real-world layouts', () => {
    for (const item of CTX_CORPUS) {
        const ctx = resolveFolderEpisodeContext(item.dirs, item.file, { folderVideoCount: item.count });
        assert.ok(ctx, `ctx should exist: ${item.name}`);
        for (const [key, value] of Object.entries(item.expect)) {
            assert.equal(ctx[key], value, `${item.name}: ctx.${key}`);
        }
    }
});

test('naming corpus: movies stay movies', () => {
    const multi = parseVideoName('Series (2010) S01E01-E02.mkv');
    assert.equal(multi.title, 'Series');
    assert.equal(multi.season, 1);
    assert.equal(multi.episode, 1);
    assert.equal(multi.episodeTitle, null, '多集区间标记不应混入集标题');

    assert.equal(resolveFolderEpisodeContext([], 'Inception.2010.1080p.mkv'), null);
    const movie = parseVideoName('Inception.2010.1080p.mkv');
    assert.equal(movie.title, 'Inception');
    assert.equal(movie.year, 2010);
    assert.equal(movie.episode, null);

    assert.equal(
        resolveFolderEpisodeContext(
            ['钢之炼金术师 (2003)', '钢之炼金术师 剧场版', '叹息之丘的圣星'],
            '[Moozzi2] Fullmetal Alchemist The Sacred Star of Milos (BD 1920x1080 x.264 5.mkv',
            { folderVideoCount: 3 }
        ),
        null
    );
});

test('naming corpus: season dir variants', () => {
    assert.deepEqual(parseSeasonDir('Season 2 罗天大醮篇'), { season: 2, showPrefix: null });
    assert.deepEqual(parseSeasonDir('Season 6'), { season: 6, showPrefix: null });
    assert.deepEqual(parseSeasonDir('Season 01'), { season: 1, showPrefix: null });
    assert.deepEqual(parseSeasonDir('S05 2022'), { season: 5, showPrefix: null });
    assert.deepEqual(parseSeasonDir('第五季'), { season: 5, showPrefix: null });
    assert.deepEqual(parseSeasonDir('Specials'), { season: 0, showPrefix: null });
    assert.deepEqual(parseSeasonDir('特别篇'), { season: 0, showPrefix: null });
    assert.equal(parseSeasonDir('动画'), null);
});

test('naming corpus: extras detection', () => {
    assert.equal(isExtraMaterial('[DBD-Raws][Kaijuu 8 Gou][OP01][1080P].mkv'), true);
    assert.equal(isExtraMaterial('[YYDM-11FANS][Fullmetal Alchemist][NCED][BDRIP].mp4'), true);
    assert.equal(isExtraMaterial('40_定档PV 众生之门.flv'), true);
    assert.equal(isExtraMaterial('(BD)鋼の錬金術師 映像特典 盲目の錬金術師.mkv'), true);
    assert.equal(isExtraMaterial('[DBD-Raws][Kaijuu 8 Gou][01][1080P][BDRip].mkv'), false);
});

function writeTree(root, files) {
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
}

test('naming corpus: ingest keeps bracket-named episodes and merges season subtitles', async () => {
    const root = makeTmpDir('fntv-corpus-');
    writeTree(root, {
        '怪兽8号/S1/[DBD-Raws][Kaijuu 8 Gou][01][1080P][BDRip][HEVC-10bit][FLACx2].mkv': 'v',
        '怪兽8号/S1/[DBD-Raws][Kaijuu 8 Gou][02][1080P][BDRip][HEVC-10bit][FLACx2].mkv': 'v',
        '怪兽8号/S1/[DBD-Raws][Kaijuu 8 Gou][OP01][1080P][BDRip].mkv': 'v',
        '怪兽8号/S2/ANi_怪獣_8_號_第二季_13_1080PBahaWEB_DLAAC_AVCCHT.mp4': 'v',
        '怪兽8号/S2/ANi_怪獣_8_號_第二季_14_1080PBahaWEB_DLAAC_AVCCHT.mp4': 'v',
        '一人之下/Season 2 罗天大醮篇/一人之下 S02E01.mkv': 'v',
        '一人之下/Season 3 入世篇/一人之下 2020.S03E01.mkv': 'v',
    });

    const store = createJsonLibraryStore(path.join(root, 'library.json'));
    const source = store.addSource({ type: 'local', name: 'Corpus', config: { rootPath: root } });
    const scan = await scanLocalFolder({ rootPath: root });
    const summary = await ingestScanResult(store, source.id, scan);

    assert.deepEqual(
        { added: summary.added, skipped: summary.skipped },
        { added: 6, skipped: 1 }
    );

    const shows = store.listShows(source.id);
    assert.equal(shows.length, 2, 'one show for 怪兽8号, one merged show for 一人之下');

    const kaijuu = shows.find((s) => s.title === '怪兽8号');
    assert.ok(kaijuu);
    const kaijuuEpisodes = store
        .listItems({ showId: kaijuu.id })
        .map((i) => `${i.season}-${i.episode}`)
        .sort();
    assert.deepEqual(kaijuuEpisodes, ['1-1', '1-2', '2-13', '2-14']);

    const yiren = shows.find((s) => s.title === '一人之下');
    assert.ok(yiren, 'Season 副标题目录应合并为同一部剧');
    const seasons = [...new Set(store.listItems({ showId: yiren.id }).map((i) => i.season))].sort();
    assert.deepEqual(seasons, [2, 3]);
});
