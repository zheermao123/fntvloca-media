const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { testLocalRoot, testWebdavSource } = require('../dest/modules/library/sourceTest.js');
const { probeWebdavRoot, sanitizeProbeMessage } = require('../dest/modules/library/webdav.js');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

test('local source test: success / not found / not a directory / empty path', async (t) => {
    const dir = makeTmpDir('fntv-srctest-');
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'a.txt');
    fs.writeFileSync(file, 'x');

    const ok = await testLocalRoot(dir);
    assert.equal(ok.reachable, true);
    assert.ok(ok.latencyMs >= 0);

    const missing = await testLocalRoot(path.join(dir, 'nope'));
    assert.deepEqual(
        { reachable: missing.reachable, reason: missing.reason },
        { reachable: false, reason: 'not_found' }
    );

    const notDir = await testLocalRoot(file);
    assert.deepEqual(
        { reachable: notDir.reachable, reason: notDir.reason },
        { reachable: false, reason: 'not_found' }
    );

    const empty = await testLocalRoot('  ');
    assert.equal(empty.reachable, false);
    assert.equal(empty.reason, 'not_found');
});

test('local source test: permission errors map to auth via injected stat', async () => {
    const denied = await testLocalRoot('C:\\restricted', async () => {
        const error = new Error('EACCES');
        error.code = 'EACCES';
        throw error;
    });
    assert.equal(denied.reachable, false);
    assert.equal(denied.reason, 'auth');

    const unknown = await testLocalRoot('C:\\weird', async () => {
        const error = new Error('EIO');
        error.code = 'EIO';
        throw error;
    });
    assert.equal(unknown.reachable, false);
    assert.equal(unknown.reason, 'network');
});

test('webdav root probe: 207/200 ok, 401/403 auth, 404 not_found, 5xx network', async () => {
    const base = { baseUrl: 'https://nas.example/dav', username: 'u', password: 'p' };
    const call = (status) => (config) => {
        assert.equal(config.method, 'PROPFIND');
        assert.equal(config.headers.Depth, '0', '单次根探测必须 Depth:0');
        return Promise.resolve({ status });
    };
    assert.deepEqual(await probeWebdavRoot(base, { request: call(207) }), { ok: true, status: 207 });
    assert.deepEqual(await probeWebdavRoot(base, { request: call(200) }), { ok: true, status: 200 });
    assert.equal((await probeWebdavRoot(base, { request: call(401) })).reason, 'auth');
    assert.equal((await probeWebdavRoot(base, { request: call(403) })).reason, 'auth');
    assert.equal((await probeWebdavRoot(base, { request: call(404) })).reason, 'not_found');
    assert.equal((await probeWebdavRoot(base, { request: call(500) })).reason, 'network');
});

test('webdav root probe: timeout / network / invalid url sanitized', async () => {
    const base = { baseUrl: 'https://nas.example/dav' };
    const timeout = await probeWebdavRoot(base, {
        request: () => Promise.reject(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })),
    });
    assert.equal(timeout.reason, 'timeout');

    const network = await probeWebdavRoot(base, {
        request: () => Promise.reject(new Error('connect ECONNREFUSED http://user:secret@127.0.0.1:5005/dav')),
    });
    assert.equal(network.reason, 'network');
    assert.ok(!network.message.includes('secret'), '消息必须脱敏（不含凭据）');

    const invalid = await probeWebdavRoot({ baseUrl: 'not-a-url' });
    assert.equal(invalid.reason, 'network');

    const empty = await probeWebdavRoot({ baseUrl: '' });
    assert.equal(empty.reason, 'network');

    const ftp = await probeWebdavRoot({ baseUrl: 'ftp://nas.example/dav' });
    assert.equal(ftp.reason, 'network');

    assert.equal(sanitizeProbeMessage('boom http://u:p@host/x'), 'boom http://***@host/x');
});

test('webdav source test reuses probe and maps results', async () => {
    const invalid = await testWebdavSource({ type: 'webdav', url: 'not-a-url' });
    assert.equal(invalid.reachable, false);
    assert.equal(invalid.reason, 'network');
    const empty = await testWebdavSource({ type: 'webdav', url: '' });
    assert.equal(empty.reachable, false);
});
