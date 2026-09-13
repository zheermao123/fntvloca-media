const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const loginPage = fs.readFileSync(path.join(__dirname, '../resource/login/index.html'), 'utf8');

test('login page exposes an optional password-style access-code control', () => {
    assert.match(loginPage, /<label for="accessCode">访问码（可选）<\/label>/);
    assert.match(loginPage, /<input type="password" id="accessCode"[^>]+autocomplete="off"/);
    assert.match(loginPage, /id="accessCodeToggle"[^>]+title="显示访问码"/);
    assert.match(loginPage, /accessCode: accessCode/);
});

test('login history and current config restore the optional access code', () => {
    assert.match(loginPage, /accessCodeInput\.value = item\.accessCode \|\| ''/);
    assert.match(loginPage, /accessCodeInput\.value = config\.accessCode/);
});

test('compact login panel remains scrollable on short windows', () => {
    assert.match(loginPage, /max-height: calc\(100vh - 24px\)/);
    assert.match(loginPage, /overflow-y: auto/);
    assert.match(loginPage, /scrollbar-gutter: stable/);
});
