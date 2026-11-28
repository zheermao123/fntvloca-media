const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const tasksService = require(
    path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'tasksService.js')
);

function installBridge() {
    const onceMap = new Map();
    const onMap = new Map();
    const sent = [];
    const offs = [];
    global.window = { setTimeout, clearTimeout };
    global.window.electronAPI = {
        send(channel, payload) {
            sent.push([channel, payload]);
        },
        once(channel, listener) {
            onceMap.set(channel, listener);
        },
        on(channel, listener) {
            const list = onMap.get(channel) ?? [];
            list.push(listener);
            onMap.set(channel, list);
        },
        off(channel, listener) {
            offs.push([channel, listener]);
            if (onceMap.get(channel) === listener) {
                onceMap.delete(channel);
            }
            const list = onMap.get(channel);
            if (list) {
                const index = list.indexOf(listener);
                if (index >= 0) {
                    list.splice(index, 1);
                }
            }
        },
    };
    return {
        sent,
        offs,
        emitOnce(channel, data) {
            const listener = onceMap.get(channel);
            onceMap.delete(channel);
            listener?.({}, data);
        },
        emitOn(channel, data) {
            (onMap.get(channel) ?? []).slice().forEach((listener) => listener({}, data));
        },
        onCount(channel) {
            return (onMap.get(channel) ?? []).length;
        },
    };
}

test('startScrape sends the trigger and resolves the real started reply', async () => {
    const bridge = installBridge();
    const promise = tasksService.startScrape();
    assert.deepEqual(bridge.sent[0], ['library:scrape', { force: false }]);
    bridge.emitOnce('library:scrape-started', { started: true });
    assert.deepEqual(await promise, { started: true, error: undefined });
});

test('startScrape cancellation removes the reply listener', async () => {
    const bridge = installBridge();
    const controller = new AbortController();
    const promise = tasksService.startScrape(controller.signal);
    const assertion = assert.rejects(promise, /IPC_CANCELLED/);
    controller.abort();
    await assertion;
    assert.equal(bridge.offs.filter(([channel]) => channel === 'library:scrape-started').length, 1);
});

test('waitScrapeDone resolves summaries and aborts cleanly', async () => {
    const bridge = installBridge();
    const done = tasksService.waitScrapeDone();
    bridge.emitOnce('library-scrape-done', { summary: { scraped: 3, failed: 1, skipped: 2 } });
    assert.deepEqual(await done, { summary: { scraped: 3, failed: 1, skipped: 2 } });

    const controller = new AbortController();
    const aborted = tasksService.waitScrapeDone(controller.signal);
    const assertion = assert.rejects(aborted, /IPC_CANCELLED/);
    controller.abort();
    await assertion;
    assert.equal(bridge.offs.filter(([channel]) => channel === 'library-scrape-done').length, 1);
});

test('progress subscription forwards values and unsubscribes exactly once', () => {
    const bridge = installBridge();
    const seen = [];
    const unsubscribe = tasksService.onScrapeProgress((progress) => seen.push(progress));
    assert.equal(bridge.onCount('library-scrape-progress'), 1);
    bridge.emitOn('library-scrape-progress', { done: 1, total: 4, title: 'a' });
    unsubscribe();
    bridge.emitOn('library-scrape-progress', { done: 2, total: 4, title: 'b' });
    assert.deepEqual(seen, [{ done: 1, total: 4, title: 'a' }]);
    assert.equal(bridge.onCount('library-scrape-progress'), 0);
});

test('fetchScrapeStatus uses IPC and parses running state', async () => {
    const bridge = installBridge();
    const promise = tasksService.fetchScrapeStatus();
    assert.deepEqual(bridge.sent[0], ['library:scrape-status', undefined]);
    bridge.emitOnce('library:scrape-status-info', { running: true, lastSummary: null });
    assert.deepEqual(await promise, { running: true, lastSummary: null });
});
