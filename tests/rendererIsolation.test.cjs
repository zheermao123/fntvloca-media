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
