const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sourcesService = require(
    path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'library', 'sourcesService.js')
);
const mediaService = require(
    path.join(__dirname, '..', 'tmp', 'renderer-test', 'services', 'media', 'mediaService.js')
);

function installBridge() {
    const onceMap = new Map();
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
        on() {},
        off(channel, listener) {
            offs.push([channel, listener]);
            onceMap.delete(channel);
        },
    };
    return {
        sent,
        offs,
        emit(channel, data) {
            const listener = onceMap.get(channel);
            onceMap.delete(channel);
            listener?.({}, data);
        },
    };
}

test('privacy/source actions use existing IPC contracts', async () => {
    const bridge = installBridge();

    const added = sourcesService.addSource({
        type: 'local',
        rootPath: 'E:\\media',
        private: true,
    });
    assert.equal(bridge.sent[0][0], 'library:add-source');
    assert.equal(bridge.sent[0][1].private, true);
    bridge.emit('library:source-added', { source: { id: 's1', name: 'Private' } });
    assert.deepEqual(await added, { id: 's1', name: 'Private' });

    const removed = sourcesService.removeSource('s1');
    assert.equal(bridge.sent[1][0], 'library:remove-source');
    bridge.emit('library:source-removed', { success: true });
    await removed;

    const watched = mediaService.setWatched('item-1', true);
    assert.deepEqual(bridge.sent[2], ['library:set-watched', { id: 'item-1', watched: true }]);
    bridge.emit('library:watched-set', { success: true });
    await watched;

    const favorite = mediaService.setFavorite('season', 'show-1', true, 2);
    assert.deepEqual(bridge.sent[3], [
        'library:set-favorite',
        { type: 'season', id: 'show-1', favorite: true, season: 2 },
    ]);
    bridge.emit('library:favorite-set', { success: true });
    await favorite;
});

test('source remove failure surfaces the real error', async () => {
    const bridge = installBridge();
    const promise = sourcesService.removeSource('missing');
    const assertion = assert.rejects(promise, /源不存在/);
    bridge.emit('library:source-removed', { success: false, error: '源不存在' });
    await assertion;
});
