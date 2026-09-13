const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanLocalFolder, isVideoFile, VIDEO_EXTENSIONS } = require('../dest/modules/library/scanner');

const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function tmpDir() {
    return makeTmpDir('fntv-libscan-');
}

function writeTree(root, files) {
    for (const [rel, content] of Object.entries(files)) {
        const full = path.join(root, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content);
    }
}

test('isVideoFile matches the extension whitelist case-insensitively', () => {
    assert.equal(isVideoFile('movie.MKV'), true);
    assert.equal(isVideoFile('movie.strm'), true);
    assert.equal(isVideoFile('movie.txt'), false);
    assert.ok(VIDEO_EXTENSIONS.includes('.mp4'));
});

test('scanLocalFolder walks nested folders and filters non-video files', async () => {
    const root = tmpDir();
    writeTree(root, {
        'Movies/Inception.2010.1080p.mkv': 'v',
        'Movies/subs/inception.srt': 's',
        'Movies/readme.txt': 't',
        'TV/Show A/Season 1/Show.A.S01E01.mp4': 'v',
        'TV/Show A/Season 1/Show.A.S01E02.mp4': 'v',
        'deep/a/b/c/d/e/f/g/h/i/j/k/l/m/too-deep.mkv': 'v',
    });

    const result = await scanLocalFolder({ rootPath: root });
    const names = result.files.map((f) => path.basename(f.path)).sort();
    assert.deepEqual(names, [
        'Inception.2010.1080p.mkv',
        'Show.A.S01E01.mp4',
        'Show.A.S01E02.mp4',
    ]);
    assert.equal(result.errors.length, 0);
    assert.equal(result.truncated, false);
    for (const file of result.files) {
        assert.ok(file.size > 0);
        assert.ok(file.mtime > 0);
    }
});

test('scanLocalFolder skips hidden, junk and system directories', async () => {
    const root = tmpDir();
    writeTree(root, {
        '.hidden/secret.mkv': 'v',
        '$RECYCLE.BIN/deleted.mkv': 'v',
        'System Volume Information/track.mkv': 'v',
        '@eaDir/thumbs.mkv': 'v',
        'lost+found/orphan.mkv': 'v',
        'Movies/keep.mkv': 'v',
        'Movies/.DS_Store': 'junk',
    });

    const result = await scanLocalFolder({ rootPath: root });
    const names = result.files.map((f) => path.basename(f.path));
    assert.deepEqual(names, ['keep.mkv']);
});

test('scanLocalFolder marks sample files but still lists them', async () => {
    const root = tmpDir();
    writeTree(root, {
        'Movies/sample-cut.mkv': 'v',
        'Movies/feature.mkv': 'v',
    });
    const result = await scanLocalFolder({ rootPath: root });
    const byName = new Map(result.files.map((f) => [path.basename(f.path), f]));
    assert.equal(byName.get('sample-cut.mkv').isSample, true);
    assert.equal(byName.get('feature.mkv').isSample, false);
});

test('scanLocalFolder reports a missing or invalid root as an error', async () => {
    const missing = path.join(tmpDir(), 'does-not-exist');
    const result = await scanLocalFolder({ rootPath: missing });
    assert.equal(result.files.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].path, missing);
});

test('scanLocalFolder respects exclude patterns and honors maxFiles', async () => {
    const root = tmpDir();
    writeTree(root, {
        'Movies/Extras/behind.mkv': 'v',
        'Movies/main.mkv': 'v',
        'TV/a.mkv': 'v',
        'TV/b.mkv': 'v',
    });

    const excluded = await scanLocalFolder({ rootPath: root, excludePatterns: ['Extras'] });
    const names = excluded.files.map((f) => path.basename(f.path)).sort();
    assert.deepEqual(names, ['a.mkv', 'b.mkv', 'main.mkv']);

    const truncated = await scanLocalFolder({ rootPath: root, maxFiles: 2 });
    assert.equal(truncated.truncated, true);
    assert.equal(truncated.files.length, 2);
});

test('scanLocalFolder sniffs misnamed video files by header', async () => {
    const root = tmpDir();
    fs.writeFileSync(path.join(root, 'misnamed.xls'), Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00]));
    fs.writeFileSync(path.join(root, 'real-excel.xls'), Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    fs.writeFileSync(path.join(root, 'notes.txt'), 'hello world, plain text');

    const result = await scanLocalFolder({ rootPath: root });
    assert.deepEqual(result.files.map((f) => path.basename(f.path)), ['misnamed.xls']);
    assert.equal(result.errors.length, 0);
});

test('scanLocalFolder sniffs mpeg-ts and mp4 containers with wrong extensions', async () => {
    const root = tmpDir();
    const ts = Buffer.alloc(192);
    ts[0] = 0x47;
    ts[188] = 0x47;
    fs.writeFileSync(path.join(root, 'stream.tsx'), ts);
    const mp4 = Buffer.alloc(16);
    mp4.write('ftyp', 4);
    fs.writeFileSync(path.join(root, 'clip.xyz'), mp4);

    const result = await scanLocalFolder({ rootPath: root });
    assert.deepEqual(
        result.files.map((f) => path.basename(f.path)).sort(),
        ['clip.xyz', 'stream.tsx']
    );
});
