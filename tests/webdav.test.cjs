const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
    parsePropfindResponse,
    scanWebdavFolder,
    buildPropfindBody,
} = require('../dest/modules/library/webdav');

function multistatus(responses) {
    return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${responses.join('\n')}
</D:multistatus>`;
}

function responseXml(href, { dir = false, size = null, mtime = null } = {}) {
    return `<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype>${dir ? '<D:collection/>' : ''}</D:resourcetype>
      ${size !== null ? `<D:getcontentlength>${size}</D:getcontentlength>` : ''}
      ${mtime !== null ? `<D:getlastmodified>${mtime}</D:getlastmodified>` : ''}
      <D:getcontenttype>${dir ? 'httpd/unix-directory' : 'video/x-matroska'}</D:getcontenttype>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}

test('buildPropfindBody requests the needed DAV props', () => {
    const body = buildPropfindBody();
    assert.match(body, /propfind/);
    assert.match(body, /getcontentlength/);
    assert.match(body, /resourcetype/);
    assert.match(body, /getlastmodified/);
});

test('parsePropfindResponse extracts files and directories with absolute urls', () => {
    const xml = multistatus([
        responseXml('/dav/', { dir: true }),
        responseXml('/dav/Movies/', { dir: true }),
        responseXml('/dav/Movies/A%202010.mkv', { size: 12345, mtime: 'Wed, 21 Oct 2015 07:28:00 GMT' }),
        responseXml('/dav/readme.txt', { size: 10 }),
    ]);
    const entries = parsePropfindResponse(xml, 'https://nas.example:5006/dav/');
    assert.equal(entries.length, 4);

    const file = entries.find((e) => e.href.endsWith('A%202010.mkv'));
    assert.ok(file);
    assert.equal(file.isDirectory, false);
    assert.equal(file.size, 12345);
    assert.equal(file.mtime, Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));
    assert.match(file.href, /^https:\/\/nas\.example:5006\/dav\/Movies\/A%202010\.mkv$/);

    const dir = entries.find((e) => e.href.endsWith('/Movies/'));
    assert.ok(dir);
    assert.equal(dir.isDirectory, true);
});

test('parsePropfindResponse returns empty list for malformed xml', () => {
    assert.deepEqual(parsePropfindResponse('', 'https://x/'), []);
    assert.deepEqual(parsePropfindResponse('<html>not dav</html>', 'https://x/'), []);
    assert.deepEqual(parsePropfindResponse('<<<broken', 'https://x/'), []);
});

test('scanWebdavFolder walks directories, filters videos and sends basic auth', async () => {
    const authHeaderSeen = [];
    const depthSeen = [];
    const routes = {
        '/dav/': multistatus([
            responseXml('/dav/', { dir: true }),
            responseXml('/dav/Movies/', { dir: true }),
            responseXml('/dav/readme.txt', { size: 5 }),
        ]),
        '/dav/Movies/': multistatus([
            responseXml('/dav/Movies/', { dir: true }),
            responseXml('/dav/Movies/A.2010.mkv', { size: 100, mtime: 'Wed, 21 Oct 2015 07:28:00 GMT' }),
            responseXml('/dav/Movies/B.2160p.iso', { size: 200 }),
            responseXml('/dav/Movies/Sub/', { dir: true }),
            responseXml('/dav/Movies/sample-cut.mkv', { size: 10 }),
        ]),
        '/dav/Movies/Sub/': multistatus([
            responseXml('/dav/Movies/Sub/', { dir: true }),
            responseXml('/dav/Movies/Sub/C.1080p.mkv', { size: 300 }),
        ]),
    };

    const server = http.createServer((req, res) => {
        authHeaderSeen.push(req.headers.authorization || null);
        depthSeen.push(req.headers.depth || null);
        const url = new URL(req.url, 'http://127.0.0.1');
        const xml = routes[url.pathname];
        if (req.method !== 'PROPFIND' || !xml) {
            res.writeHead(404);
            res.end('not found');
            return;
        }
        res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
        res.end(xml);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
        const result = await scanWebdavFolder({
            baseUrl: `http://127.0.0.1:${port}/dav/`,
            username: 'user',
            password: 'pass',
            timeoutMs: 5000,
        });

        assert.equal(result.errors.length, 0);
        assert.equal(result.truncated, false);
        const names = result.files.map((f) => f.path.split('/').pop()).sort();
        assert.deepEqual(names, ['A.2010.mkv', 'B.2160p.iso', 'C.1080p.mkv', 'sample-cut.mkv']);

        const sample = result.files.find((f) => f.path.includes('sample-cut'));
        assert.equal(sample.isSample, true);
        const a = result.files.find((f) => f.path.includes('A.2010.mkv'));
        assert.equal(a.size, 100);
        assert.equal(a.mtime, Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'));

        // Basic Auth 头存在且只发送一次编码后的凭据
        const expectedAuth = 'Basic ' + Buffer.from('user:pass').toString('base64');
        assert.ok(authHeaderSeen.length > 0);
        assert.ok(authHeaderSeen.every((h) => h === expectedAuth));
        assert.ok(depthSeen.every((d) => d === '1'));
    } finally {
        server.close();
    }
});

test('scanWebdavFolder reports connection failures as errors', async () => {
    // 指向一个未监听的端口
    const result = await scanWebdavFolder({
        baseUrl: 'http://127.0.0.1:1/dav/',
        timeoutMs: 2000,
    });
    assert.equal(result.files.length, 0);
    assert.equal(result.errors.length, 1);
});
