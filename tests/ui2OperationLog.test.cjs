const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const log = require(
    path.join(__dirname, '..', 'tmp', 'renderer-test', 'app', 'operationLog.js')
);

test('operation log keeps running records until the software session ends', () => {
    log.resetOperationsForTests();
    const scanId = log.startOperation({ kind: 'scan', title: '扫描媒体库' });
    const sourceId = log.startOperation({
        kind: 'sourceScan',
        title: '扫描媒体源',
        target: '私有源',
        private: true,
    });

    assert.equal(log.getOperations().length, 2);
    assert.equal(log.getOperations()[0].title, '扫描媒体源');
    assert.equal(log.findRunningOperation('scan')?.id, scanId);

    log.finishOperation(scanId, 'success', '新增 0，更新 0，移除 0');
    const scan = log.getOperations().find((record) => record.id === scanId);
    assert.equal(scan.status, 'success');
    assert.equal(scan.summary, '新增 0，更新 0，移除 0');
    assert.ok(scan.finishedAt);
    assert.equal(log.findRunningOperation('scan'), undefined);
    assert.equal(log.findRunningOperation('sourceScan')?.id, sourceId);

    // 再完成一次不应重复改写结果。
    log.finishOperation(scanId, 'error', '不应覆盖');
    assert.equal(log.getOperations().find((record) => record.id === scanId).status, 'success');
});

test('operation log stores private flag and recovers running scrape', () => {
    log.resetOperationsForTests();
    const id = log.startOperation({
        kind: 'scrape',
        title: 'TMDB 刮削',
        summary: '检测到主进程刮削正在运行',
        recovered: true,
    });
    const record = log.findRunningOperation('scrape');
    assert.equal(record.id, id);
    assert.equal(record.recovered, true);
    assert.equal(record.private, false);

    log.finishOperation(id, 'error', 'TMDB API Key 未配置');
    assert.equal(log.getOperations()[0].status, 'error');
    assert.equal(log.getOperations()[0].summary, 'TMDB API Key 未配置');
});
