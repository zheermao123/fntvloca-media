const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sources = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'sources', 'sources.mapper.js'));
const tasks = require(path.join(__dirname, '..', 'tmp', 'renderer-test', 'pages', 'tasks', 'tasks.mapper.js'));
const tasksMapper = tasks;

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
                config: { rootPath: 'E:\\media' },
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

test('session task helpers keep order, finish state and labels', () => {
    let tasks = [];
    tasks = tasksMapper.addSessionTask(tasks, {
        id: 'scan-1',
        kind: 'scan',
        startedAt: 1000,
        finishedAt: null,
        status: 'running',
        summary: '进行中',
    });
    tasks = tasksMapper.addSessionTask(tasks, {
        id: 'scrape-2',
        kind: 'scrape',
        startedAt: 2000,
        finishedAt: null,
        status: 'running',
        summary: '进行中',
    });
    assert.deepEqual(tasks.map((task) => task.id), ['scrape-2', 'scan-1']);

    tasks = tasksMapper.finishSessionTask(tasks, 'scan-1', 'success', '完成', 3000);
    const scan = tasks.find((task) => task.id === 'scan-1');
    assert.equal(scan.status, 'success');
    assert.equal(scan.finishedAt, 3000);

    assert.equal(tasksMapper.taskKindLabel('scan'), '媒体库扫描');
    assert.equal(tasksMapper.taskKindLabel('scrape'), 'TMDB 刮削');
    assert.equal(tasksMapper.taskStatusLabel('running'), '进行中');
    assert.equal(tasksMapper.taskStatusLabel('success'), '已完成');
    assert.equal(tasksMapper.taskStatusLabel('error'), '失败');
    assert.match(tasksMapper.formatTaskTime(0), /^\d{2}:\d{2}:\d{2}$/);
});

test('session task list caps at bounded size', () => {
    let tasks = [];
    for (let i = 0; i < 25; i += 1) {
        tasks = tasksMapper.addSessionTask(tasks, {
            id: `task-${i}`,
            kind: 'scan',
            startedAt: i,
            finishedAt: null,
            status: 'running',
            summary: '',
        });
    }
    assert.equal(tasks.length, 20);
    assert.equal(tasks[0].id, 'task-24');
});
test('source test result formatting never leaks raw paths or credentials', () => {
    assert.equal(sources.formatSourceTestResult({ reachable: true, latencyMs: 12 }), '连接正常（12ms）');
    assert.equal(
        sources.formatSourceTestResult({ reachable: false, latencyMs: 0, reason: 'auth' }),
        '连接失败：认证失败'
    );
    assert.equal(
        sources.formatSourceTestResult({ reachable: false, latencyMs: 0, reason: 'network' }),
        '连接失败：网络不可达'
    );
    assert.equal(
        sources.formatSourceTestResult({ reachable: false, latencyMs: 0, reason: 'not_found' }),
        '连接失败：路径不存在'
    );
});