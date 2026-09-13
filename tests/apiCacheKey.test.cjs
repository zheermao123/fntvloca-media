const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiCacheKey } = require('../dest/modules/fn_api/cacheKey.js');

test('isolates API cache keys by server and token without exposing the token', () => {
    const token = 'sensitive-token-value';
    const first = createApiCacheKey('https://nas-a.test', token, 'getUserInfo', []);
    const otherServer = createApiCacheKey('https://nas-b.test', token, 'getUserInfo', []);
    const otherToken = createApiCacheKey('https://nas-a.test', 'other-token', 'getUserInfo', []);

    assert.notEqual(first, otherServer);
    assert.notEqual(first, otherToken);
    assert.equal(first.includes(token), false);
});
