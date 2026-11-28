const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createSingleFlight } = require(
    path.join(__dirname, '..', 'dest', 'main', 'handlers', 'plugins', 'scanGuard.js')
);

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

test('concurrent scan triggers are rejected while first is running', async () => {
    const guard = createSingleFlight();
    const gate = deferred();
    const first = guard.run(async () => {
        await gate.promise;
        return 'done';
    });
    assert.equal(guard.isRunning(), true);
    const second = await guard.run(async () => 'should-not-run');
    assert.deepEqual(second, { started: false });
    gate.resolve();
    assert.deepEqual(await first, { started: true, value: 'done' });
    assert.equal(guard.isRunning(), false);
});

test('guard releases after completion and allows the next scan', async () => {
    const guard = createSingleFlight();
    await guard.run(async () => undefined);
    const next = await guard.run(async () => 42);
    assert.deepEqual(next, { started: true, value: 42 });
    assert.equal(guard.isRunning(), false);
});

test('guard releases after task failure and next scan proceeds', async () => {
    const guard = createSingleFlight();
    await assert.rejects(
        guard.run(async () => {
            throw new Error('boom');
        }),
        /boom/
    );
    assert.equal(guard.isRunning(), false);
    const retry = await guard.run(async () => 'ok');
    assert.deepEqual(retry, { started: true, value: 'ok' });
});
