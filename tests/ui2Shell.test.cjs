const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const exists = (...parts) => fs.existsSync(path.join(root, ...parts));

test('router uses HashRouter and defines all Phase 2 routes', () => {
    const router = read('src', 'renderer', 'app', 'AppRouter.tsx');
    assert.match(router, /HashRouter/, '必须使用 HashRouter（file:// 兼容）');
    assert.doesNotMatch(router, /BrowserRouter/, '不得使用 BrowserRouter');
    for (const route of ['/home', '/library/:category', '/media/:id', '/sources', '/tasks']) {
        assert.ok(router.includes(route), `缺少路由: ${route}`);
    }
});

test('category=other maps to /library/others and segments resolve back', () => {
    const routes = read('src', 'renderer', 'app', 'routes.ts');
    assert.match(routes, /other:\s*\{\s*label:\s*'其他视频',\s*segment:\s*'others'\s*\}/);
    assert.match(routes, /resolveCategoryFromSegment/);
    for (const segment of ["'movies'", "'tv'", "'anime'", "'others'"]) {
        assert.ok(routes.includes(segment), `缺少分类 segment: ${segment}`);
    }
});

test('shell layout reserves the injected titlebar and keeps interactive elements draggable-safe', () => {
    const shellCss = read('src', 'renderer', 'styles', 'shell.css');
    assert.match(shellCss, /\.app-window\s*\{[^}]*top:\s*var\(--layout-titlebar-height\)/s);
    assert.match(shellCss, /-webkit-app-region:\s*no-drag/);
    const windowFrame = read('src', 'renderer', 'layout', 'WindowFrame.tsx');
    assert.doesNotMatch(windowFrame, /min-btn|max-btn|close-btn/, '不得重复实现窗口控制按钮');
});

test('shell files exist', () => {
    for (const file of [
        ['src', 'renderer', 'app', 'AppBootstrap.tsx'],
        ['src', 'renderer', 'app', 'AppRouter.tsx'],
        ['src', 'renderer', 'app', 'AppShell.tsx'],
        ['src', 'renderer', 'app', 'PrivacyStateProvider.tsx'],
        ['src', 'renderer', 'app', 'AppErrorBoundary.tsx'],
        ['src', 'renderer', 'layout', 'WindowFrame.tsx'],
        ['src', 'renderer', 'layout', 'Sidebar.tsx'],
        ['src', 'renderer', 'layout', 'PrimaryNavigation.tsx'],
        ['src', 'renderer', 'layout', 'PageHeader.tsx'],
        ['src', 'renderer', 'layout', 'MainRegion.tsx'],
        ['src', 'renderer', 'pages', 'home', 'HomePage.tsx'],
        ['src', 'renderer', 'pages', 'library', 'LibraryPage.tsx'],
        ['src', 'renderer', 'pages', 'detail', 'MediaDetailPage.tsx'],
        ['src', 'renderer', 'pages', 'sources', 'SourcesPage.tsx'],
        ['src', 'renderer', 'pages', 'tasks', 'TasksPage.tsx'],
        ['src', 'renderer', 'styles', 'shell.css'],
    ]) {
        assert.ok(exists(...file), `缺少文件: ${file.join('/')}`);
    }
    assert.ok(!exists('src', 'renderer', 'App.tsx'), '旧壳 App.tsx 应已移除');
});

test('global search shortcut (Ctrl/Cmd+K) and privacy state wiring are present', () => {
    const shell = read('src', 'renderer', 'app', 'AppShell.tsx');
    assert.match(shell, /ctrlKey\s*\|\|\s*event\.metaKey/);
    assert.match(shell, /toLowerCase\(\)\s*===\s*'k'/);
    const sidebar = read('src', 'renderer', 'layout', 'Sidebar.tsx');
    assert.match(sidebar, /usePrivacyState/);
    const provider = read('src', 'renderer', 'app', 'PrivacyStateProvider.tsx');
    assert.match(provider, /library:privacy-begin/);
    assert.match(provider, /library:privacy-unlock/);
    assert.match(provider, /library:privacy-lock/);
});
