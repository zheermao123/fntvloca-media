const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { extractNfoMetadata, loadNfoMetadata, findPosterForVideo } = require('../dest/modules/library/nfo');

const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function tmpDir() {
    return makeTmpDir('fntv-libnfo-');
}

test('extractNfoMetadata parses a movie nfo', () => {
    const xml = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<movie>',
        '  <title>Inception &amp; Dreams</title>',
        '  <originaltitle>Inception</originaltitle>',
        '  <year>2010</year>',
        '  <plot>A thief who steals corporate secrets.</plot>',
        '  <rating>8.8</rating>',
        '  <runtime>148</runtime>',
        '  <uniqueid type="tmdb">27205</uniqueid>',
        '  <tmdbid>27205</tmdbid>',
        '  <thumb>http://example.com/poster.jpg</thumb>',
        '  <thumb>http://example.com/fanart.jpg</thumb>',
        '</movie>',
    ].join('\n');

    const meta = extractNfoMetadata(xml);
    assert.equal(meta.title, 'Inception & Dreams');
    assert.equal(meta.originalTitle, 'Inception');
    assert.equal(meta.year, 2010);
    assert.equal(meta.plot, 'A thief who steals corporate secrets.');
    assert.equal(meta.rating, 8.8);
    assert.equal(meta.runtime, 148);
    assert.equal(meta.tmdbId, '27205');
    assert.equal(meta.thumb, 'http://example.com/poster.jpg');
});

test('extractNfoMetadata parses an episodedetails nfo', () => {
    const xml = [
        '<episodedetails>',
        '  <title>Winter Is Coming</title>',
        '  <showtitle>Game of Thrones</showtitle>',
        '  <season>1</season>',
        '  <episode>1</episode>',
        '  <aired>2011-04-17</aired>',
        '</episodedetails>',
    ].join('\n');

    const meta = extractNfoMetadata(xml);
    assert.equal(meta.title, 'Winter Is Coming');
    assert.equal(meta.showTitle, 'Game of Thrones');
    assert.equal(meta.season, 1);
    assert.equal(meta.episode, 1);
});

test('extractNfoMetadata parses a tvshow nfo with cdata plot', () => {
    const xml = [
        '<tvshow>',
        '  <title>Dark</title>',
        '  <plot><![CDATA[Time travel in & a small town]]></plot>',
        '  <year>2017</year>',
        '</tvshow>',
    ].join('\n');

    const meta = extractNfoMetadata(xml);
    assert.equal(meta.title, 'Dark');
    assert.equal(meta.plot, 'Time travel in & a small town');
    assert.equal(meta.year, 2017);
});

test('extractNfoMetadata returns null for malformed or foreign xml', () => {
    assert.equal(extractNfoMetadata('<html><body>not an nfo</body></html>'), null);
    assert.equal(extractNfoMetadata(''), null);
    assert.equal(extractNfoMetadata('<<broken'), null);
});

test('loadNfoMetadata reads the best-matching nfo next to the video', async () => {
    const dir = tmpDir();
    const video = path.join(dir, 'Movie.2010.mkv');
    fs.writeFileSync(video, 'v');
    fs.writeFileSync(path.join(dir, 'random.nfo'), '<movie><title>Wrong</title></movie>');
    fs.writeFileSync(path.join(dir, 'Movie.2010.nfo'), '<movie><title>Right</title></movie>');

    const meta = await loadNfoMetadata(video);
    assert.equal(meta.title, 'Right');
});

test('loadNfoMetadata ignores unrelated nfos in flat multi-video directories', async () => {
    const dir = tmpDir();
    const target = path.join(dir, 'Another.Movie.2019.mkv');
    fs.writeFileSync(target, 'v');
    fs.writeFileSync(path.join(dir, 'Other.Movie.2007.mkv'), 'v');
    fs.writeFileSync(path.join(dir, 'Other.Movie.2007.nfo'), '<movie><title>Other</title><tmdbid>4588</tmdbid></movie>');

    assert.equal(await loadNfoMetadata(target), null);
});

test('loadNfoMetadata uses movie.nfo only in single-video directories', async () => {
    const single = tmpDir();
    const soloVideo = path.join(single, 'Solo.2020.mkv');
    fs.writeFileSync(soloVideo, 'v');
    fs.writeFileSync(path.join(single, 'movie.nfo'), '<movie><title>Solo Title</title></movie>');
    const solo = await loadNfoMetadata(soloVideo);
    assert.equal(solo.title, 'Solo Title');

    const multi = tmpDir();
    const first = path.join(multi, 'First.mkv');
    fs.writeFileSync(first, 'v');
    fs.writeFileSync(path.join(multi, 'Second.mkv'), 'v');
    fs.writeFileSync(path.join(multi, 'movie.nfo'), '<movie><title>Should Not Apply</title></movie>');
    assert.equal(await loadNfoMetadata(first), null);
});

test('loadNfoMetadata returns null when no nfo exists', async () => {
    const dir = tmpDir();
    const video = path.join(dir, 'Movie.mkv');
    fs.writeFileSync(video, 'v');
    assert.equal(await loadNfoMetadata(video), null);
});

test('findPosterForVideo prefers basename posters over folder posters', async () => {
    const dir = tmpDir();
    const video = path.join(dir, 'Movie.2010.mkv');
    fs.writeFileSync(video, 'v');
    fs.writeFileSync(path.join(dir, 'folder.jpg'), 'p');
    assert.equal(await findPosterForVideo(video), path.join(dir, 'folder.jpg'));

    fs.writeFileSync(path.join(dir, 'Movie.2010-poster.jpg'), 'p');
    assert.equal(await findPosterForVideo(video), path.join(dir, 'Movie.2010-poster.jpg'));

    fs.writeFileSync(path.join(dir, 'poster.png'), 'p');
    assert.equal(await findPosterForVideo(video), path.join(dir, 'Movie.2010-poster.jpg'));
});

test('findPosterForVideo returns null when nothing exists', async () => {
    const dir = tmpDir();
    const video = path.join(dir, 'Movie.mkv');
    fs.writeFileSync(video, 'v');
    assert.equal(await findPosterForVideo(video), null);
});
