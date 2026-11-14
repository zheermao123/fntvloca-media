const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    resolveUiShell,
    normalizeLoopbackDevUrl,
    UI2_DEV_HOST,
    UI2_DEV_PORT,
} = require('../dest/main/common/uiShell.js');

test('resolveUiShell: packaged builds always use classic', () => {
    assert.deepEqual(
        resolveUiShell({
            isPackaged: true,
            envShell: 'react',
            envDevServerUrl: `http://${UI2_DEV_HOST}:${UI2_DEV_PORT}/`,
            reactEntryExists: true,
        }),
        { shell: 'classic', devServerUrl: null }
    );
});

test('resolveUiShell: development defaults to classic without explicit env', () => {
    assert.deepEqual(
        resolveUiShell({ isPackaged: false, envShell: undefined, envDevServerUrl: undefined, reactEntryExists: true }),
        { shell: 'classic', devServerUrl: null }
    );
    assert.deepEqual(
        resolveUiShell({ isPackaged: false, envShell: 'classic', envDevServerUrl: undefined, reactEntryExists: true }),
        { shell: 'classic', devServerUrl: null }
    );
});

test('resolveUiShell: development can force react with a valid dev server url', () => {
    assert.deepEqual(
        resolveUiShell({
            isPackaged: false,
            envShell: 'REACT',
            envDevServerUrl: `http://localhost:${UI2_DEV_PORT}`,
            reactEntryExists: false,
        }),
        { shell: 'react', devServerUrl: `http://${UI2_DEV_HOST}:${UI2_DEV_PORT}/` }
    );
});

test('resolveUiShell: development react without dev url uses the built entry when present', () => {
    assert.deepEqual(
        resolveUiShell({ isPackaged: false, envShell: 'react', envDevServerUrl: undefined, reactEntryExists: true }),
        { shell: 'react', devServerUrl: null }
    );
});

test('resolveUiShell: react assets missing falls back to classic', () => {
    assert.deepEqual(
        resolveUiShell({ isPackaged: false, envShell: 'react', envDevServerUrl: undefined, reactEntryExists: false }),
        { shell: 'classic', devServerUrl: null }
    );
});

test('normalizeLoopbackDevUrl only accepts fixed loopback dev origins', () => {
    assert.equal(normalizeLoopbackDevUrl(`http://127.0.0.1:${UI2_DEV_PORT}`), `http://${UI2_DEV_HOST}:${UI2_DEV_PORT}/`);
    assert.equal(normalizeLoopbackDevUrl(`http://localhost:${UI2_DEV_PORT}/`), `http://${UI2_DEV_HOST}:${UI2_DEV_PORT}/`);
    assert.equal(normalizeLoopbackDevUrl(`http://127.0.0.1:9999`), null, '错误端口拒绝');
    assert.equal(normalizeLoopbackDevUrl('https://127.0.0.1:5273'), null, '非 http 拒绝');
    assert.equal(normalizeLoopbackDevUrl('http://192.168.1.5:5273'), null, '非 loopback 拒绝');
    assert.equal(normalizeLoopbackDevUrl('http://example.com:5273'), null, '远程域名拒绝');
    assert.equal(normalizeLoopbackDevUrl(''), null);
    assert.equal(normalizeLoopbackDevUrl('not-a-url'), null);
});
