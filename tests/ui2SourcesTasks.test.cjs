const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sources = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'sources', 'sources.mapper.js'));
const tasks = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'tasks', 'tasks.mapper.js'));

test('source rows hide sensitive locations in privacy mode and strip url credentials', () => {
    const rows = sources.toSourceRows(
        [
            {
                id: 's1',
                type: 'webdav',
                name: 'NAS',
                config: { url: 'https://user:secret@nas.local:5005/dav' },
                createdAt: 1,
                lastScanAt: null,
                itemCount: 12,
            },
        ],
        false
    );
    assert.equal(rows[0].location, 'https://nas.local:5005/dav');
    assert.equal(rows[0].typeLabel, 'WebDAV');
    assert.equal(rows[0].lastScanLabel, '从未扫描');
    assert.equal(rows[0].itemCount, 12);
    const hidden = sources.toSourceRows(
        [
            {
                id: 's1',
                type: 'local',
                name: 'Local',
                config: { path: 'E:\\media' },
                createdAt: 1,
                lastScanAt: 1,
                itemCount: 1,
            },
        ],
        true
    );
    assert.equal(hidden[0].location, '已隐藏（隐私模式）');
});

test('scan results format all outcomes', () => {
    assert.equal(
        sources.formatScanResult({ added: 2, updated: 3, removed: 1, skipped: 4 }),
        '扫描完成：新增 2，更新 3，移除 1，跳过 4'
    );
    assert.equal(
        sources.formatScanResult({ added: 0, updated: 0, removed: 1, skipped: 0, removedSources: ['Old'] }),
        '扫描完成：新增 0，更新 0，移除 1，跳过 0，已清理失效源：Old'
    );
    assert.equal(sources.formatScanResult({ error: '已有扫描任务在进行中' }), '扫描失败：已有扫描任务在进行中');
});

test('scrape summary and percent are derived from real fields', () => {
    assert.equal(tasks.describeScrapeSummary(null), null);
    assert.equal(
        tasks.describeScrapeSummary({ scraped: 8, failed: 1, skipped: 2 }),
        '上次刮削：成功 8，失败 1，跳过 2'
    );
    assert.equal(
        tasks.describeScrapeSummary({ scraped: 0, failed: 1, skipped: 0, firstError: 'timeout' }),
        '上次刮削：成功 0，失败 1，跳过 0（首个错误：timeout）'
    );
    assert.equal(tasks.scrapePercent({ done: 1, total: 4, title: 'x' }), 25);
    assert.equal(tasks.scrapePercent({ done: 9, total: 4, title: 'x' }), 100);
    assert.equal(tasks.scrapePercent({ done: 0, total: 0, title: 'x' }), 0);
});
