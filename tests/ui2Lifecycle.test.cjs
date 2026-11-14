const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('privacy deactivation returns to home and closes search', () => {
    const shell = read('src/renderer/app/AppShell.tsx');
    assert.ok(shell.includes('prevPrivacyActive'));
    assert.ok(shell.includes('navigate(ROUTES.home'));
    assert.ok(shell.includes('setSearchOpen(false)'));
    const provider = read('src/renderer/app/PrivacyStateProvider.tsx');
    assert.ok(provider.includes('if (busy)'));
    assert.ok(provider.includes('桌面桥接不可用'));
});

test('async catalog pages guard against stale responses', () => {
    for (const file of [
        'src/renderer/pages/library/LibraryPage.tsx',
        'src/renderer/pages/home/HomePage.tsx',
        'src/renderer/pages/detail/MediaDetailPage.tsx',
        'src/renderer/pages/search/SearchPanel.tsx',
    ]) {
        const source = read(file);
        assert.ok(
            source.includes('requestSeqRef') || source.includes('cancelled'),
            `${file} must guard stale async state`
        );
    }
});

test('long-lived task waits are cancellable and listeners are cleaned', () => {
    const tasksPage = read('src/renderer/pages/tasks/TasksPage.tsx');
    assert.ok(tasksPage.includes('scanInFlightRef'));
    assert.ok(tasksPage.includes('scrapeInFlightRef'));
    assert.ok(tasksPage.includes('scanAbortRef'));
    assert.ok(tasksPage.includes('scrapeAbortRef'));
    assert.ok(tasksPage.includes('unsubscribeRef.current?.()'));
    const sourcesPage = read('src/renderer/pages/sources/SourcesPage.tsx');
    assert.ok(sourcesPage.includes('scanAbortRef'));
    assert.ok(sourcesPage.includes('.abort()'));
    const tasksService = read('src/renderer/services/library/tasksService.ts');
    assert.ok(tasksService.includes('onceReplyCancellable'));
    assert.ok(tasksService.includes('IPC_CANCELLED'));
});
