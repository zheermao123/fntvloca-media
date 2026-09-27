const { test } = require('node:test');
const assert = require('node:assert/strict');

const { hasCJK, extractChineseTitle, preferChinese } = require('../dest/modules/library/chineseTitle');

test('hasCJK detects CJK ideographs only', () => {
    assert.equal(hasCJK('蜘蛛侠：英雄无归'), true);
    assert.equal(hasCJK('Spider-Man: No Way Home'), false);
    assert.equal(hasCJK('ハンザワ'), false);
    assert.equal(hasCJK(''), false);
    assert.equal(hasCJK(null), false);
    assert.equal(hasCJK(undefined), false);
});

test('extractChineseTitle extracts Chinese name from release file names', () => {
    assert.equal(
        extractChineseTitle('[蜘蛛侠：英雄归来][DIY 双版本国语THD+AC3 简英繁特效六字幕 BDJ菜单修改].mkv'),
        '蜘蛛侠：英雄归来'
    );
    assert.equal(
        extractChineseTitle('[非自然死亡 DIY 簡繁中字] UNNATURAL 1080i BLURAY AVC LPCM 2.0'),
        '非自然死亡'
    );
    assert.equal(
        extractChineseTitle('[半泽直树][导演剪辑版DIY简繁中字 ].Hanzawa.Naoki.2013.DC.BluRay'),
        '半泽直树'
    );
    assert.equal(extractChineseTitle('Godzilla King of the Monsters 2019 USA V2 BluRay REMUX'), null);
    assert.equal(extractChineseTitle(''), null);
    assert.equal(extractChineseTitle(null), null);
});

test('preferChinese picks first Chinese candidate then first non-empty', () => {
    assert.equal(preferChinese('Inception', '盗梦空间'), '盗梦空间');
    assert.equal(preferChinese('盗梦空间', 'Inception'), '盗梦空间');
    assert.equal(preferChinese('Inception', null, ''), 'Inception');
    assert.equal(preferChinese(null, null), '');
    assert.equal(preferChinese('', 'Goblin'), 'Goblin');
});
