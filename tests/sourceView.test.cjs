const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { toRendererSource } = require(path.join('..', 'dest', 'modules', 'library', 'sourceCategory.js'));

test('renderer source view strips credential ciphertext only', () => {
    const source = {
        id: 's1',
        type: 'webdav',
        name: 'NAS',
        config: {
            url: 'https://nas.local/dav',
            username: 'user',
            passwordEnc: 'encrypted-secret',
            category: 'movie',
            private: '1',
        },
        createdAt: 1,
        lastScanAt: null,
    };
    const view = toRendererSource(source);
    assert.equal('passwordEnc' in view.config, false);
    assert.equal(view.config.url, 'https://nas.local/dav');
    assert.equal(view.config.username, 'user');
    assert.equal(view.config.category, 'movie');
    assert.equal(view.config.private, '1');
    assert.equal(view.name, 'NAS');
});
