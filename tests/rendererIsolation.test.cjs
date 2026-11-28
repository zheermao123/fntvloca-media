const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('main window disables renderer Node access and enables context isolation', () => {
    const mainWindow = fs.readFileSync(
        path.join(__dirname, '..', 'dest', 'main', 'common', 'mainwin.js'),
        'utf8',
    );
    assert.match(mainWindow, /nodeIntegration:\s*false/);
    assert.match(mainWindow, /contextIsolation:\s*true/);
});

test('login page uses the restricted preload bridge and renders history as text', () => {
    const loginPage = fs.readFileSync(
        path.join(__dirname, '..', 'resource', 'login', 'index.html'),
        'utf8',
    );
    assert.doesNotMatch(loginPage, /require\(['"]electron['"]\)/);
    assert.match(loginPage, /window\.electronAPI/);
    assert.match(loginPage, /account\.textContent = item\.account/);
    assert.doesNotMatch(loginPage, /data-password="\$\{/);
});

test('preload exposes the bridge only on file pages or the exact loopback dev origin', () => {
    const preload = fs.readFileSync(
        path.join(__dirname, '..', 'dest', 'preload', 'index.js'),
        'utf8',
    );
    assert.match(preload, /isDevBridgeOrigin/, '必须使用开发源白名单判定');
    assert.match(preload, /FNTV_UI_SHELL/, '开发源判定必须受开发模式环境变量约束');
    assert.match(preload, /file:.*\n|'file:'/, '必须保留 file: 页面支持');
    assert.doesNotMatch(preload, /exposeInMainWorld\(\s*['"]ipcRenderer['"]/, '不得暴露 ipcRenderer 本体');
});

test('preload allowlist registers real channel pairs including the three known gaps', () => {
    const preload = fs.readFileSync(
        path.join(__dirname, '..', 'dest', 'preload', 'index.js'),
        'utf8',
    );
    for (const channel of [
        'library:set-source-category',
        'library:source-updated',
        'library:scrape-status-info',
        'library:test-source',
        'library:test-source-result',
        'library:update-source',
        'library:history',
        'library:history-info',
    ]) {
        assert.ok(preload.includes(channel), `白名单缺少真实通道: ${channel}`);
    }
});

test('dev bridge origin helper only accepts the fixed loopback dev origin', () => {
    const { isDevBridgeOrigin, UI2_DEV_BRIDGE_PORT } = require('../dest/preload/core/devOrigin.js');
    assert.equal(isDevBridgeOrigin(`http://127.0.0.1:${UI2_DEV_BRIDGE_PORT}/`, 'react'), true);
    assert.equal(isDevBridgeOrigin(`http://localhost:${UI2_DEV_BRIDGE_PORT}/`, 'REACT'), true);
    assert.equal(isDevBridgeOrigin(`http://127.0.0.1:${UI2_DEV_BRIDGE_PORT}/`, undefined), false, '非 react 模式拒绝');
    assert.equal(isDevBridgeOrigin(`http://127.0.0.1:${UI2_DEV_BRIDGE_PORT}/`, 'classic'), false);
    assert.equal(isDevBridgeOrigin('http://127.0.0.1:9999/', 'react'), false, '错误端口拒绝');
    assert.equal(isDevBridgeOrigin('https://127.0.0.1:5273/', 'react'), false, 'https 拒绝');
    assert.equal(isDevBridgeOrigin('http://192.168.1.5:5273/', 'react'), false, '局域网拒绝');
    assert.equal(isDevBridgeOrigin('http://example.com:5273/', 'react'), false, '远程域名拒绝');
    assert.equal(isDevBridgeOrigin('', 'react'), false);
});
