const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    resolveBundledMpvPath,
    resolvePortableConfigDir,
    synchronizeMpvConfig,
} = require('../dest/main/common/mpvConfigHelpers.js');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

test('resolves the packaged mpv executable next to the application executable', () => {
    assert.equal(
        resolveBundledMpvPath({
            appPath: path.join('C:', 'app', 'resources', 'app.asar'),
            execPath: path.join('C:', 'app', 'FNMedia.exe'),
            isPackaged: true,
        }),
        path.join('C:', 'app', 'third_party', 'fntv-mpv', 'mpv.exe'),
    );
});

test('resolves packaged extraFiles next to the resources directory on every platform', () => {
    assert.equal(
        resolvePortableConfigDir({
            appPath: path.join('C:', 'app', 'resources', 'app.asar'),
            isPackaged: true,
            resourcesPath: path.join('C:', 'app', 'resources'),
        }),
        path.join('C:', 'app', 'third_party', 'fntv-mpv', 'portable_config'),
    );
});

test('updates only managed danmaku code and preserves user-owned MPV state', (t) => {
    const root = makeTmpDir('fntv-mpv-sync-');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const portable = path.join(root, 'portable_config');
    const user = path.join(root, 'user_config');
    const bundledPlugin = path.join(portable, 'scripts', 'uosc_danmaku');
    const userPlugin = path.join(user, 'scripts', 'uosc_danmaku');
    fs.mkdirSync(bundledPlugin, { recursive: true });
    fs.mkdirSync(userPlugin, { recursive: true });
    fs.mkdirSync(path.join(user, 'script-opts'), { recursive: true });

    fs.writeFileSync(path.join(bundledPlugin, 'main.lua'), 'VERSION = "2.1.0"');
    fs.writeFileSync(path.join(userPlugin, 'main.lua'), 'VERSION = "2.0.0"');
    fs.writeFileSync(path.join(user, 'scripts', 'custom.lua'), 'custom-script');

    const preservedFiles = new Map([
        [path.join(user, 'script-opts', 'uosc_danmaku.conf'), Buffer.from('opacity=0.42\n')],
        [path.join(user, 'script-opts', 'uosc.conf'), Buffer.from('controls=custom\r\n')],
        [path.join(user, 'danmaku-history.json'), Buffer.from('{"show_danmaku":false}')],
    ]);
    for (const [file, content] of preservedFiles) fs.writeFileSync(file, content);

    assert.equal(synchronizeMpvConfig(portable, user), 'updated');
    assert.equal(fs.readFileSync(path.join(userPlugin, 'main.lua'), 'utf8'), 'VERSION = "2.1.0"');
    assert.equal(fs.readFileSync(path.join(user, 'scripts', 'custom.lua'), 'utf8'), 'custom-script');
    for (const [file, content] of preservedFiles) {
        assert.deepEqual(fs.readFileSync(file), content);
    }
});

test('seeds the complete bundled configuration on first initialization', (t) => {
    const root = makeTmpDir('fntv-mpv-init-');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const portable = path.join(root, 'portable_config');
    const user = path.join(root, 'user_config');
    fs.mkdirSync(path.join(portable, 'scripts', 'uosc_danmaku'), { recursive: true });
    fs.writeFileSync(path.join(portable, 'scripts', 'uosc_danmaku', 'main.lua'), 'bundled');
    fs.writeFileSync(path.join(portable, 'danmaku-history.json'), '{"show_danmaku":true}');

    assert.equal(synchronizeMpvConfig(portable, user), 'initialized');
    assert.equal(fs.readFileSync(path.join(user, 'scripts', 'uosc_danmaku', 'main.lua'), 'utf8'), 'bundled');
    assert.equal(fs.readFileSync(path.join(user, 'danmaku-history.json'), 'utf8'), '{"show_danmaku":true}');
});

test('first initialization does not overwrite pre-existing user state', (t) => {
    const root = makeTmpDir('fntv-mpv-seed-');
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const portable = path.join(root, 'portable_config');
    const user = path.join(root, 'user_config');
    fs.mkdirSync(path.join(portable, 'scripts', 'uosc_danmaku'), { recursive: true });
    fs.mkdirSync(path.join(portable, 'script-opts'), { recursive: true });
    fs.mkdirSync(path.join(user, 'script-opts'), { recursive: true });
    fs.writeFileSync(path.join(portable, 'scripts', 'uosc_danmaku', 'main.lua'), 'bundled');
    fs.writeFileSync(path.join(portable, 'script-opts', 'uosc.conf'), 'bundled-controls');
    fs.writeFileSync(path.join(user, 'script-opts', 'uosc.conf'), 'user-controls');

    assert.equal(synchronizeMpvConfig(portable, user), 'initialized');
    assert.equal(fs.readFileSync(path.join(user, 'script-opts', 'uosc.conf'), 'utf8'), 'user-controls');
    assert.equal(fs.readFileSync(path.join(user, 'scripts', 'uosc_danmaku', 'main.lua'), 'utf8'), 'bundled');
});
