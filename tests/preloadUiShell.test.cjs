const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { isUi2ReactDocument } = require(
    path.join(__dirname, '..', 'dest', 'preload', 'core', 'uiShell.js')
);

test('detects packaged and dev react documents', () => {
    assert.equal(
        isUi2ReactDocument({
            protocol: 'file:',
            hostname: '',
            port: '',
            pathname: '/C:/Program Files/fntv/resources/app.asar/ui2-renderer/index.html',
        }),
        true
    );
    assert.equal(
        isUi2ReactDocument({
            protocol: 'http:',
            hostname: '127.0.0.1',
            port: '5273',
            pathname: '/',
        }),
        true
    );
    assert.equal(
        isUi2ReactDocument({
            protocol: 'http:',
            hostname: 'localhost',
            port: '5273',
            pathname: '/',
        }),
        true
    );
});

test('does not classify classic/login or non-loopback pages as react', () => {
    for (const location of [
        { protocol: 'file:', hostname: '', port: '', pathname: '/C:/fntv/resource/library/index.html' },
        { protocol: 'file:', hostname: '', port: '', pathname: '/C:/fntv/resource/login/index.html' },
        { protocol: 'http:', hostname: '127.0.0.1', port: '9999', pathname: '/' },
        { protocol: 'https:', hostname: 'nas.local', port: '5273', pathname: '/' },
    ]) {
        assert.equal(isUi2ReactDocument(location), false);
    }
});
