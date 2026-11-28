const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'vite.config.ts'), 'utf8');

function extractCsp(name) {
    const match = source.match(new RegExp(`const ${name} =\\s*\\n?\\s*"([^"]+)"`));
    assert.ok(match, `${name} not found`);
    return match[1];
}

test('production CSP stays strict (no unsafe-inline/eval, no remote)', () => {
    const csp = extractCsp('PRODUCTION_CSP');
    assert.ok(csp.includes("script-src 'self'"));
    assert.ok(csp.includes("style-src 'self'"));
    assert.ok(csp.includes("connect-src 'none'"));
    assert.ok(!csp.includes('unsafe-inline'));
    assert.ok(!csp.includes('unsafe-eval'));
});

test('development CSP only loosens inline styles for Vite injection', () => {
    const csp = extractCsp('DEVELOPMENT_CSP');
    assert.ok(csp.includes("style-src 'self' 'unsafe-inline'"));
    assert.ok(csp.includes("script-src 'self'") && !csp.includes("script-src 'self' 'unsafe-inline'"));
    assert.ok(csp.includes('connect-src') && csp.includes('ws://127.0.0.1:5273'));
    assert.ok(!csp.includes('unsafe-eval'));
});
