const test = require('node:test');
const assert = require('node:assert/strict');
const { isProxyHealthPayload } = require('../dest/main/common/proxyHealth.js');

test('accepts only the fntv proxy health contract', () => {
    assert.equal(isProxyHealthPayload({ service: 'fntv-proxy', protocol: 2 }), true);
    assert.equal(isProxyHealthPayload({ service: 'other', protocol: 2 }), false);
    assert.equal(isProxyHealthPayload({ service: 'fntv-proxy', protocol: 1 }), false);
    assert.equal(isProxyHealthPayload(null), false);
});
