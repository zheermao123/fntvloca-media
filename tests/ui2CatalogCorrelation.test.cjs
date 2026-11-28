const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('concurrent catalog queries resolve their own requestId replies', async () => {
    const handlers = new Map();
    const sends = [];
    const bridge = {
        send(channel, payload) {
            sends.push({ channel, payload });
        },
        on(channel, listener) {
            const list = handlers.get(channel) ?? [];
            list.push(listener);
            handlers.set(channel, list);
        },
        off(channel, listener) {
            const list = handlers.get(channel) ?? [];
            handlers.set(
                channel,
                list.filter((entry) => entry !== listener)
            );
        },
        once() {
            throw new Error('catalog correlation must use on/off');
        },
    };
    global.window = {
        electronAPI: bridge,
        setTimeout,
        clearTimeout,
    };
    const service = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'libraryService.js'));

    const emit = (channel, data) => {
        for (const listener of handlers.get(channel) ?? []) {
            listener(undefined, data);
        }
    };

    const first = service.queryCatalogPage({ category: 'movie', limit: 1 });
    const second = service.queryCatalogPage({ category: 'tv', limit: 1 });
    await new Promise((resolve) => setImmediate(resolve));

    const catalogSends = sends.filter((entry) => entry.channel === 'library:catalog');
    assert.equal(catalogSends.length, 2);
    const [requestA, requestB] = catalogSends.map((entry) => entry.payload.requestId);
    assert.ok(requestA);
    assert.ok(requestB);
    assert.notEqual(requestA, requestB);

    // 故意逆序回包，并先发一条不匹配的旧回包。
    emit('library:catalog-info', { requestId: 'stale-request', entries: [], total: 999 });
    emit('library:catalog-info', { requestId: requestB, entries: [], total: 22 });
    emit('library:catalog-info', { requestId: requestA, entries: [], total: 11 });

    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.total, 11);
    assert.equal(b.total, 22);
});
