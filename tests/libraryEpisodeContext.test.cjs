const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    resolveFolderEpisodeContext,
    parseSeasonDirName,
    cleanDirectoryTitle,
} = require('../dest/modules/library/episodeContext');

test('parseSeasonDirName recognizes common season directory styles', () => {
    assert.equal(parseSeasonDirName('S01'), 1);
    assert.equal(parseSeasonDirName('s2'), 2);
    assert.equal(parseSeasonDirName('Season 3'), 3);
    assert.equal(parseSeasonDirName('第4季'), 4);
    assert.equal(parseSeasonDirName('第12季'), 12);
    assert.equal(parseSeasonDirName('第二季'), 2);
    assert.equal(parseSeasonDirName('唐诡奇谭'), null);
    assert.equal(parseSeasonDirName('Movies'), null);
});

test('cleanDirectoryTitle strips group prefix and year brackets', () => {
    assert.equal(cleanDirectoryTitle('亮剑 (2005)'), '亮剑');
    assert.equal(cleanDirectoryTitle('士兵突击（2006）'), '士兵突击');
    assert.equal(cleanDirectoryTitle('[组名] 我的·阿勒泰 (2024)'), '我的·阿勒泰');
    assert.equal(cleanDirectoryTitle('去有风的地方'), '去有风的地方');
});

test('bare numeric files inside a series folder become episodes of the folder show', () => {
    const ctx = resolveFolderEpisodeContext(['去有风的地方'], '01.mkv', { folderVideoCount: 40 });
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '去有风的地方');
    assert.equal(ctx.season, 1);
    assert.equal(ctx.episode, 1);
    assert.equal(ctx.year, null);

    const ctx2 = resolveFolderEpisodeContext(['士兵突击（2006）'], '30.mp4', { folderVideoCount: 30 });
    assert.ok(ctx2);
    assert.equal(ctx2.showTitle, '士兵突击');
    assert.equal(ctx2.year, 2006);
    assert.equal(ctx2.episode, 30);

    // 单视频文件夹不按剧集处理（排除单片电影文件夹）
    assert.equal(resolveFolderEpisodeContext(['寂静之地2'], '01.mkv', { folderVideoCount: 1 }), null);
});

test('glued chinese title plus trailing digits become episodes', () => {
    const ctx = resolveFolderEpisodeContext(['琅琊榜(2015)'], '琅琊榜01.mp4', { folderVideoCount: 54 });
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '琅琊榜');
    assert.equal(ctx.year, 2015);
    assert.equal(ctx.episode, 1);

    const ctx2 = resolveFolderEpisodeContext(['沉默的荣耀'], '沉默的荣耀29.mp4', { folderVideoCount: 39 });
    assert.ok(ctx2);
    assert.equal(ctx2.showTitle, '沉默的荣耀');
    assert.equal(ctx2.episode, 29);
});

test('season directories set season numbers and keep the parent as show', () => {
    const ctx = resolveFolderEpisodeContext(['唐朝诡事录', 'S02'], '唐朝诡事录 01.mp4');
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '唐朝诡事录');
    assert.equal(ctx.season, 2);
    assert.equal(ctx.episode, 1);

    const ctx2 = resolveFolderEpisodeContext(
        ['唐朝诡事录', 'S03'],
        '唐朝诡事录之长安_S03E01.mp4'
    );
    assert.ok(ctx2);
    assert.equal(ctx2.showTitle, '唐朝诡事录');
    assert.equal(ctx2.season, 3);
    assert.equal(ctx2.episode, 1);
});

test('non-season subdirectory inside a series folder is treated as its own show', () => {
    const ctx = resolveFolderEpisodeContext(
        ['唐朝诡事录', '唐诡奇谭'],
        '唐朝诡事录_Strange_Tales_of_Tang_Dynasty_S04E19_2025_2160p_WEB_DL_H265.mp4'
    );
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '唐诡奇谭');
    assert.equal(ctx.season, 4);
    assert.equal(ctx.episode, 19);
});

test('special editions belong to the parent show season 0', () => {
    const ctx = resolveFolderEpisodeContext(
        ['庆余年', 'S01'],
        '[庆余年第一季 特别版].Joy.of.Life.Special.Edition.S01E01.2024.2160p.mkv'
    );
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '庆余年');
    assert.equal(ctx.season, 0);
    assert.equal(ctx.episode, 1);

    const ctx2 = resolveFolderEpisodeContext(['排球少年', 'Specials'], '02.mp4', {
        folderVideoCount: 10,
    });
    assert.ok(ctx2);
    assert.equal(ctx2.showTitle, '排球少年');
    assert.equal(ctx2.season, 0);
    assert.equal(ctx2.episode, 2);
});

test('season dirs with suffixes and version subdirs are transparent', () => {
    const ctx = resolveFolderEpisodeContext(['一人之下', 'S05 2022'], '一人之下 第五季_01_4K.mp4', {
        folderVideoCount: 24,
    });
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '一人之下');
    assert.equal(ctx.season, 5);
    assert.equal(ctx.episode, 1);

    const ctx2 = resolveFolderEpisodeContext(['钢之炼金术师 (2003)', '日语版'], '[YYDM-11FANS][Fullmetal Alchemist][01][BDRIP][720P].mp4', {
        folderVideoCount: 51,
    });
    assert.ok(ctx2);
    assert.equal(ctx2.showTitle, '钢之炼金术师');
    assert.equal(ctx2.year, 2003);
    assert.equal(ctx2.episode, 1);

    const ctx3 = resolveFolderEpisodeContext(['罗小黑战记', 'TV动画'], '01 - 喵.flv', {
        folderVideoCount: 40,
    });
    assert.ok(ctx3);
    assert.equal(ctx3.showTitle, '罗小黑战记');
    assert.equal(ctx3.episode, 1);

    const ctx4 = resolveFolderEpisodeContext(['灵笼', '灵笼 S01 4K (2019)'], '16.灵笼[特别篇].mp4', {
        folderVideoCount: 16,
    });
    assert.ok(ctx4);
    assert.equal(ctx4.showTitle, '灵笼');
    assert.equal(ctx4.season, 0);
    assert.equal(ctx4.episode, 16);
});

test('extra material (OP/ED/PV) is excluded', () => {
    const { isExtraMaterial } = require('../dest/modules/library/episodeContext');
    assert.equal(isExtraMaterial('[YYDM-11FANS][Fullmetal Alchemist][OP04][BDRIP].mp4'), true);
    assert.equal(isExtraMaterial('[VCB-Studio] Show [NCED][Ma10p].mkv'), true);
    assert.equal(isExtraMaterial('40_定档PV 众生之门.flv'), true);
    assert.equal(isExtraMaterial('[YYDM-11FANS][Fullmetal Alchemist][01][BDRIP].mp4'), false);
    assert.equal(isExtraMaterial('(BD)鋼の錬金術師 FULLMETAL ALCHEMIST 映像特典 盲目の錬金術師.mkv'), true);
});

test('underscore-leading episode numbers and season+year folders', () => {
    const ctx = resolveFolderEpisodeContext(['一人之下', 'S06 2026'], '01_4K.mp4', {
        folderVideoCount: 26,
    });
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '一人之下');
    assert.equal(ctx.season, 6);
    assert.equal(ctx.episode, 1);

    const ctx2 = resolveFolderEpisodeContext(['进击的巨人', 'TV动画'], '39_巨木之林的大逃杀.flv', {
        folderVideoCount: 59,
    });
    assert.ok(ctx2);
    assert.equal(ctx2.showTitle, '进击的巨人');
    assert.equal(ctx2.episode, 39);
});

test('preview specials go to season 0; release noise is not an episode number', () => {
    const ctx = resolveFolderEpisodeContext(['灵笼', '灵笼 S02 4K（2025）'], '第二季前瞻篇：长夜将至.mp4', {
        folderVideoCount: 14,
    });
    assert.ok(ctx);
    assert.equal(ctx.showTitle, '灵笼');
    assert.equal(ctx.season, 0);
    assert.equal(ctx.episode, 1);

    const ctx2 = resolveFolderEpisodeContext(
        ['钢之炼金术师 (2003)', '剧场版', '叹息之丘的圣星'],
        '[Moozzi2] Fullmetal Alchemist The Sacred Star of Milos (BD 1920x1080 x.264 5.mkv',
        { folderVideoCount: 3 }
    );
    assert.equal(ctx2, null);
});

test('movies and root-level files are not converted into episodes', () => {
    assert.equal(resolveFolderEpisodeContext([], '01.mkv'), null);
    assert.equal(
        resolveFolderEpisodeContext(
            ['碟中谍 第5部 4K原盘REMUX 杜比视界'],
            'Missien.Impassible.Regue.Netion.2160p.BluRay.REMUX.HEVC.xls'
        ),
        null
    );
    assert.equal(
        resolveFolderEpisodeContext(['Movies'], 'Inception.2010.1080p.mkv'),
        null
    );
    assert.equal(
        resolveFolderEpisodeContext(['Show'], 'Blade Runner 2049.mkv'),
        null
    );
});
