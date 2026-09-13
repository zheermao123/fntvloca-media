const test = require('node:test');
const assert = require('node:assert/strict');

const {
    AccessCodeVerificationError,
    encodeAccessCode,
    establishAccessCodeSession,
    resolveAccessCodeRedirect,
} = require('../dest/main/common/accessCodeSession.js');
const {
    composeCookieHeader,
    getAccessCookieHeader,
    setAccessGrant,
} = require('../dest/modules/fn_api/accessGrant.js');

test('encodes Unicode access codes as UTF-8 Base64', () => {
    assert.equal(encodeAccessCode('访问-123'), Buffer.from('访问-123', 'utf8').toString('base64'));
});

test('follows same-host port redirects and records only the NAS gateway cookie', async () => {
    const calls = [];
    const fakeSession = {
        cookies: {
            async get(filter) {
                assert.deepEqual(filter, { url: 'http://10.0.0.115:5666/' });
                return [
                    { name: 'Trim-MC-token', value: 'media-token' },
                    { name: 'mode', value: 'relay' },
                    { name: 'z-gateway', value: 'second' },
                    { name: 'access-session', value: 'gateway-value' },
                ];
            },
        },
    };
    const requester = async (_gatewaySession, url, headers) => {
        calls.push({ url, headers });
        return { status: 204, url: 'http://10.0.0.115:5666/access_code_verify' };
    };

    const result = await establishAccessCodeSession(
        'http://10.0.0.115',
        '  访问-123  ',
        fakeSession,
        requester,
    );

    assert.equal(result.baseUrl, 'http://10.0.0.115:5666');
    assert.equal(result.cookie, 'access-session=gateway-value; z-gateway=second');
    assert.equal(getAccessCookieHeader(result.baseUrl), result.cookie);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers['x-access-source'], 'web');
    assert.equal(calls[0].headers['x-access-code'], encodeAccessCode('访问-123'));
    assert.equal(
        composeCookieHeader(result.cookie, 'mode=relay; duplicate=first; duplicate=second'),
        'access-session=gateway-value; z-gateway=second; duplicate=first; mode=relay',
    );
});

test('maps rejected access codes to a stable error without reading cookies', async () => {
    let cookiesRead = false;
    const fakeSession = {
        cookies: { async get() { cookiesRead = true; return []; } },
    };
    const requester = async (_gatewaySession, url) => ({ status: 401, url });

    await assert.rejects(
        establishAccessCodeSession('http://nas.example', 'wrong-secret', fakeSession, requester),
        error => error instanceof AccessCodeVerificationError && error.reason === 'rejected',
    );
    assert.equal(cookiesRead, false);
});

test('a rejected attempt clears grants created for a previously redirected origin', async () => {
    setAccessGrant('http://nas.example:5666', 'gateway=stale');
    const fakeSession = {
        cookies: { async get() { return []; } },
    };
    const requester = async (_gatewaySession, url) => ({
        status: 401,
        url: url.replace('nas.example', 'nas.example:5666'),
    });

    await assert.rejects(
        establishAccessCodeSession('http://nas.example', 'wrong-secret', fakeSession, requester),
        error => error instanceof AccessCodeVerificationError && error.reason === 'rejected',
    );
    assert.equal(getAccessCookieHeader('http://nas.example:5666'), '');
});

test('rejects a nominal success that did not establish a gateway cookie', async () => {
    const fakeSession = {
        cookies: {
            async get() {
                return [
                    { name: 'Trim-MC-token', value: 'media-token' },
                    { name: 'mode', value: 'relay' },
                ];
            },
        },
    };
    const requester = async (_gatewaySession, url) => ({ status: 204, url });

    await assert.rejects(
        establishAccessCodeSession('http://nas.example', 'secret', fakeSession, requester),
        error => error instanceof AccessCodeVerificationError && error.reason === 'network',
    );
});

test('an empty access code leaves the existing login flow untouched', async () => {
    let fetchCalled = false;
    const fakeSession = {
        cookies: { async get() { return []; } },
    };
    const requester = async () => { fetchCalled = true; throw new Error('must not request'); };

    setAccessGrant('https://nas.example:5666', 'gateway=stale');
    const result = await establishAccessCodeSession('https://nas.example/path', '  ', fakeSession, requester);
    assert.deepEqual(result, { baseUrl: 'https://nas.example', cookie: '' });
    assert.equal(fetchCalled, false);
    assert.equal(getAccessCookieHeader('https://nas.example:5666'), '');
});

test('rejects redirects that would disclose the access code to another host', async () => {
    assert.throws(
        () => resolveAccessCodeRedirect(
            'https://nas.example/access_code_verify',
            'https://attacker.example/access_code_verify',
        ),
        error => error instanceof AccessCodeVerificationError && error.reason === 'network',
    );
});

test('allows the common HTTP port redirect without changing hosts', () => {
    assert.equal(
        resolveAccessCodeRedirect(
            'http://10.0.0.115/access_code_verify',
            'http://10.0.0.115:5666/access_code_verify',
        ).toString(),
        'http://10.0.0.115:5666/access_code_verify',
    );
});
