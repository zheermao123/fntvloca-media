const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {
    PROXY_SECRET_FILENAME,
    isValidProxySecret,
    loadOrCreateProxySecret,
} = require('../dest/main/common/proxySecret.js');
const { probeProxyHealth } = require('../dest/main/common/proxyHealth.js');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function createStateDirectory(t) {
    const directory = makeTmpDir('fntv-proxy-secret-');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

test('reuses the same 256-bit proxy secret across application lifecycles', (t) => {
    const stateDirectory = createStateDirectory(t);
    const firstLifecycle = loadOrCreateProxySecret(stateDirectory);
    const secondLifecycle = loadOrCreateProxySecret(stateDirectory);
    const secretPath = path.join(stateDirectory, PROXY_SECRET_FILENAME);

    assert.equal(firstLifecycle, secondLifecycle);
    assert.equal(isValidProxySecret(firstLifecycle), true);
    assert.equal(fs.readFileSync(secretPath, 'utf8'), firstLifecycle);
    assert.deepEqual(fs.readdirSync(stateDirectory), [PROXY_SECRET_FILENAME]);
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(secretPath).mode & 0o777, 0o600);
    }
});

test('atomically replaces malformed proxy secret state', (t) => {
    const stateDirectory = createStateDirectory(t);
    const secretPath = path.join(stateDirectory, PROXY_SECRET_FILENAME);
    fs.writeFileSync(secretPath, 'not-a-valid-secret', { mode: 0o644 });

    const replacement = loadOrCreateProxySecret(stateDirectory);
    assert.equal(isValidProxySecret(replacement), true);
    assert.notEqual(replacement, 'not-a-valid-secret');
    assert.equal(fs.readFileSync(secretPath, 'utf8'), replacement);
    if (process.platform !== 'win32') {
        assert.equal(fs.statSync(secretPath).mode & 0o777, 0o600);
    }
});

test('persisted secret authenticates an orphan proxy health probe', async (t) => {
    const stateDirectory = createStateDirectory(t);
    const orphanSecret = loadOrCreateProxySecret(stateDirectory);
    const server = http.createServer((request, response) => {
        if (request.headers['x-fntv-proxy-secret'] !== orphanSecret) {
            response.writeHead(401).end();
            return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ service: 'fntv-proxy', protocol: 2 }));
    });
    t.after(() => server.close());

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, 'object');
    const healthUrl = `http://127.0.0.1:${address.port}/health`;

    const restartedLifecycleSecret = loadOrCreateProxySecret(stateDirectory);
    assert.equal(await probeProxyHealth(restartedLifecycleSecret, 500, healthUrl), true);
    assert.equal(await probeProxyHealth('0'.repeat(64), 500, healthUrl), false);
});
