const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCertificateHost } = require('../dest/modules/cert_trust/host.js');

test('normalizes HTTPS and WSS URLs to the same certificate host', () => {
    assert.equal(normalizeCertificateHost('https://192.0.2.10:5667/v'), '192.0.2.10:5667');
    assert.equal(normalizeCertificateHost('wss://192.0.2.10:5667/websocket'), '192.0.2.10:5667');
});

test('uses protocol default ports and accepts host input', () => {
    assert.equal(normalizeCertificateHost('https://nas.local/v'), 'nas.local:443');
    assert.equal(normalizeCertificateHost('ws://nas.local/socket'), 'nas.local:80');
    assert.equal(normalizeCertificateHost('nas.local:8443'), 'nas.local:8443');
});
