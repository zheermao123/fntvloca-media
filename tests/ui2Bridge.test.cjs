const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function installBridge() {
    const listeners = new Map();
    const offs = [];
    global.window = { setTimeout, clearTimeout };
    global.window.electronAPI = {
        once(channel, listener) {
            listeners.set(channel, listener);
        },
        off(channel, listener) {
            offs.push([channel, listener]);
            listeners.delete(channel);
        },
        send() {},
        on() {},
    };
    return {
        emit(channel, data) {
            const listener = listeners.get(channel);
            listeners.delete(channel);
            listener?.({}, data);
        },
        listeners,
        offs,
    };
}

const bridge = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'app', 'bridge.js'));

test('onceReplyCancellable resolves and clears timer on reply', async () => {
    const mock = installBridge();
    const handle = bridge.onceReplyCancellable('demo-reply', 1000);
    mock.emit('demo-reply', { value: 42 });
    assert.deepEqual(await handle.promise, { value: 42 });
    assert.equal(mock.offs.length, 0);
});

test('cancel rejects with IPC_CANCELLED and removes listener', async () => {
    const mock = installBridge();
    const handle = bridge.onceReplyCancellable('demo-reply', 60_000);
    const assertion = assert.rejects(handle.promise, /IPC_CANCELLED/);
    handle.cancel();
    await assertion;
    assert.equal(mock.offs.length, 1);
    assert.equal(mock.offs[0][0], 'demo-reply');
});

test('timeout rejects with IPC_TIMEOUT and removes listener', async () => {
    const mock = installBridge();
    const handle = bridge.onceReplyCancellable('demo-reply', 10);
    await assert.rejects(handle.promise, /IPC_TIMEOUT/);
    assert.equal(mock.offs.length, 1);
});
