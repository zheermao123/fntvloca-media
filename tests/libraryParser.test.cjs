const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseVideoName, buildShowKey } = require('../dest/modules/library/parser');

test('parseVideoName extracts english movie with year and resolution', () => {
    const r = parseVideoName('Inception.2010.1080p.BluRay.x264.mkv');
    assert.equal(r.title, 'Inception');
    assert.equal(r.year, 2010);
    assert.equal(r.resolution, '1080p');
    assert.equal(r.season, null);
    assert.equal(r.episode, null);
    assert.equal(r.isSample, false);
});

test('parseVideoName extracts SxxExx episode with episode title', () => {
    const r = parseVideoName('Game.of.Thrones.S01E02.The.Kings.Road.720p.mkv');
    assert.equal(r.title, 'Game of Thrones');
    assert.equal(r.season, 1);
    assert.equal(r.episode, 2);
    assert.equal(r.episodeTitle, 'The Kings Road');
    assert.equal(r.resolution, '720p');
    assert.equal(r.year, null);
});

test('parseVideoName extracts 2x03 style episode', () => {
    const r = parseVideoName('Friends.2x03.The.One.Where.Nobody.Slept.mkv');
    assert.equal(r.title, 'Friends');
    assert.equal(r.season, 2);
    assert.equal(r.episode, 3);
    assert.equal(r.episodeTitle, 'The One Where Nobody Slept');
});

test('parseVideoName extracts chinese season and episode markers', () => {
    const r = parseVideoName('庆余年.第2季.第03集.1080p.mkv');
    assert.equal(r.title, '庆余年');
    assert.equal(r.season, 2);
    assert.equal(r.episode, 3);
    assert.equal(r.resolution, '1080p');
});

test('parseVideoName keeps digits inside chinese titles without markers', () => {
    const r = parseVideoName('流浪地球2.2023.2160p.mkv');
    assert.equal(r.title, '流浪地球2');
    assert.equal(r.year, 2023);
    assert.equal(r.resolution, '2160p');
    assert.equal(r.episode, null);
});

test('parseVideoName extracts anime trailing episode number', () => {
    const r = parseVideoName('鬼灭之刃 - 05 [1080p].mkv');
    assert.equal(r.title, '鬼灭之刃');
    assert.equal(r.episode, 5);
    assert.equal(r.season, null);
    assert.equal(r.resolution, '1080p');
});

test('parseVideoName normalizes 4K to 2160p', () => {
    const r = parseVideoName('Up.2009.4K.mkv');
    assert.equal(r.resolution, '2160p');
    assert.equal(r.year, 2009);
});

test('parseVideoName handles Season N E M form', () => {
    const r = parseVideoName('Show.Season.2.E03.mkv');
    assert.equal(r.title, 'Show');
    assert.equal(r.season, 2);
    assert.equal(r.episode, 3);
});

test('parseVideoName extracts EP token episode', () => {
    const r = parseVideoName('Nurse.EP12.mkv');
    assert.equal(r.title, 'Nurse');
    assert.equal(r.episode, 12);
});

test('parseVideoName strips release tags from title when no year present', () => {
    const r = parseVideoName('Heat.1995.2160p.WEB-DL.x265.10bit.mkv');
    assert.equal(r.title, 'Heat');
    assert.equal(r.year, 1995);
    assert.equal(r.resolution, '2160p');
});

test('parseVideoName prefers the last standalone year in the name', () => {
    const r = parseVideoName('Blade.Runner.2049.2017.2160p.mkv');
    assert.equal(r.title, 'Blade Runner 2049');
    assert.equal(r.year, 2017);
});

test('parseVideoName does not treat a bare year title as a year', () => {
    const r = parseVideoName('2012.mkv');
    assert.equal(r.title, '2012');
    assert.equal(r.year, null);
});

test('parseVideoName flags sample files', () => {
    assert.equal(parseVideoName('sample-Inception.mkv').isSample, true);
    assert.equal(parseVideoName('Inception.sample.mkv').isSample, true);
    assert.equal(parseVideoName('Inception.2010.1080p.mkv').isSample, false);
});

test('parseVideoName falls back to the cleaned name for weird files', () => {
    const r = parseVideoName('????.mkv');
    assert.equal(typeof r.title, 'string');
});

test('parseVideoName ignores episode-like tokens inside words', () => {
    const r = parseVideoName('Se7en.1995.1080p.mkv');
    assert.equal(r.title, 'Se7en');
    assert.equal(r.year, 1995);
    assert.equal(r.episode, null);
});

test('parseVideoName strips leading group brackets from anime names', () => {
    const r = parseVideoName('[SubGroup] Frieren - 12 [1080p][HEVC].mkv');
    assert.equal(r.title, 'Frieren');
    assert.equal(r.episode, 12);
    assert.equal(r.resolution, '1080p');
});

test('buildShowKey groups titles case-insensitively with year', () => {
    assert.equal(buildShowKey('Game of Thrones', 2011), buildShowKey('game.of.thrones', 2011));
    assert.notEqual(buildShowKey('Game of Thrones', 2011), buildShowKey('Game of Thrones', 2012));
    assert.equal(buildShowKey('Dark', null), 'dark@');
});

test('parseVideoName cleans chinese-style bracketed release names', () => {
    const r = parseVideoName('[复仇者联盟][美版原盘 DIY 国语][The Avengers 2012 ULTRAHD Blu-ray 2160p HEVC Atmos TrueHD 7.1-sGnb@CHDBits].iso');
    assert.equal(r.title, 'The Avengers');
    assert.equal(r.year, 2012);
    assert.equal(r.resolution, '2160p');
    assert.equal(r.episode, null);
});

test('parseVideoName strips dangling parenthesis for paren-year names', () => {
    const r = parseVideoName('碟中谍8：最终清算 (2025) - 2160p.AppleTV.WEB-DL.DoVi.HDR10+.H.265.DDP.5.1-HDSky.mkv');
    assert.equal(r.title, '碟中谍8：最终清算');
    assert.equal(r.year, 2025);
    assert.equal(r.resolution, '2160p');
});

test('parseVideoName handles dotted chinese title with paren year', () => {
    const r = parseVideoName('色·戒.Lust Caution (2007) - 1080p.Blu-ray.H.265 10-bit.DTS-HD 7.1.mkv');
    assert.equal(r.title, '色·戒 Lust Caution');
    assert.equal(r.year, 2007);
    assert.equal(r.resolution, '1080p');
});

test('parseVideoName cleans doubled bracket tails', () => {
    const r = parseVideoName('[教父2 The Godfather Part II 1974][豆瓣电影评分9.3][[4K].iso');
    assert.equal(r.title, '教父2 The Godfather Part II');
    assert.equal(r.year, 1974);
    assert.equal(r.resolution, '2160p');
});
