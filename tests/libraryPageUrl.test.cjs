const { test } = require('node:test');
const assert = require('node:assert/strict');

const { checkLibraryPageUrl } = require('../dest/main/common/utils.js');

test('checkLibraryPageUrl detects the local media library page', () => {
    assert.equal(
        checkLibraryPageUrl('file:///C:/Users/x/AppData/Local/Programs/fntv/resources/app/resource/library/index.html'),
        true
    );
    assert.equal(checkLibraryPageUrl('file:///E:/fntv-electron-release/resource/library/index.html'), true);
});

test('checkLibraryPageUrl detects fnOS web library pages', () => {
    assert.equal(checkLibraryPageUrl('https://nas.local:5666/v/library/abc'), true);
    assert.equal(checkLibraryPageUrl('https://nas.local:5666/v/favorite'), true);
    assert.equal(checkLibraryPageUrl('https://nas.local:5666/v/list/123'), true);
    assert.equal(checkLibraryPageUrl('https://nas.local:5666/v/folder/9'), true);
});

test('checkLibraryPageUrl rejects other pages', () => {
    assert.equal(checkLibraryPageUrl('file:///C:/app/resource/login/index.html'), false);
    assert.equal(checkLibraryPageUrl('https://nas.local:5666/v/home'), false);
    assert.equal(checkLibraryPageUrl('https://example.com/'), false);
    assert.equal(checkLibraryPageUrl(''), false);
});
