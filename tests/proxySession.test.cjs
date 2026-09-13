const test = require('node:test');
const assert = require('node:assert/strict');
const { createProxyPlaybackUrl } = require('../dest/main/common/proxySession.js');

test('proxy playback URLs expose only the short-lived session capability', () => {
    const session = 'a'.repeat(64);
    const url = createProxyPlaybackUrl(session, 'item-guid', 2);
    assert.equal(
        url,
        `http://127.0.0.1:22345/api/v1/playvideo/item-guid?session=${session}&sourceIndex=2`,
    );
    assert.doesNotMatch(url, /token=|account=|domain=|accessCode=|accessCookie=/);
});
