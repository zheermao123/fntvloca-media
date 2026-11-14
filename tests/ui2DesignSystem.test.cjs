const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const exists = (...parts) => fs.existsSync(path.join(root, ...parts));

test('design tokens cover color/typography/spacing/radius/shadow/stacking/motion', () => {
    const tokens = read('src', 'renderer', 'styles', 'tokens.css');
    for (const token of [
        '--color-bg',
        '--color-surface',
        '--color-text-primary',
        '--color-text-secondary',
        '--color-accent',
        '--color-danger',
        '--font-family-base',
        '--font-size-md',
        '--font-weight-semibold',
        '--space-4',
        '--radius-lg',
        '--shadow-2',
        '--z-modal',
        '--duration-fast',
        '--layout-titlebar-height',
    ]) {
        assert.ok(tokens.includes(token), `缺少 token: ${token}`);
    }
    assert.match(tokens, /\[data-theme='dark'\]/, '必须提供 Dark 预留 tokens');
});

test('design system stylesheet files exist', () => {
    for (const file of [
        ['src', 'renderer', 'styles', 'tokens.css'],
        ['src', 'renderer', 'styles', 'reset.css'],
        ['src', 'renderer', 'styles', 'global.css'],
        ['src', 'renderer', 'styles', 'components.css'],
        ['src', 'renderer', 'theme', 'theme.ts'],
        ['src', 'renderer', 'theme', 'ThemeProvider.tsx'],
        ['src', 'renderer', 'components', 'icons', 'index.tsx'],
        ['src', 'renderer', 'components', 'media', 'PosterImage.tsx'],
    ]) {
        assert.ok(exists(...file), `缺少文件: ${file.join('/')}`);
    }
});

test('renderer components avoid inline style attributes (strict CSP style-src self)', () => {
    const offenders = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(tsx|ts)$/.test(entry.name)) {
                const source = fs.readFileSync(full, 'utf8');
                if (/style=\{\{/.test(source) || /\sstyle="/.test(source)) {
                    offenders.push(path.relative(root, full));
                }
            }
        }
    };
    walk(path.join(root, 'src', 'renderer'));
    assert.deepEqual(offenders, [], `以下文件包含内联样式: ${offenders.join(', ')}`);
});

test('base components expose required accessibility attributes', () => {
    assert.match(read('src', 'renderer', 'components', 'ui', 'Button.tsx'), /aria-busy/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'IconButton.tsx'), /aria-label=\{label\}/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'Dialog.tsx'), /role="dialog"/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'Dialog.tsx'), /aria-modal="true"/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'Input.tsx'), /aria-invalid/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'Dropdown.tsx'), /role="menu"/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'Dropdown.tsx'), /aria-haspopup="menu"/);
    assert.match(read('src', 'renderer', 'components', 'media', 'PosterImage.tsx'), /onError/);
    assert.match(read('src', 'renderer', 'components', 'ui', 'Tooltip.tsx'), /data-tooltip/);
});

test('theme provider defaults to light and applies data-theme at runtime', () => {
    assert.match(read('src', 'renderer', 'theme', 'theme.ts'), /DEFAULT_THEME_MODE: ThemeMode = 'light'/);
    const provider = read('src', 'renderer', 'theme', 'ThemeProvider.tsx');
    assert.match(provider, /document\.documentElement\.dataset\.theme = resolved/);
    assert.match(read('src', 'renderer', 'index.html'), /<html lang="zh-CN" data-theme="light">/);
});
