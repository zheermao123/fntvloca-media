const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { planSourceUpdate } = require('../dest/modules/library/sourceEdit.js');
const { createJsonLibraryStore } = require('../dest/modules/library/store.js');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function currentSource(overrides = {}) {
    return {
        id: 'src-1',
        type: 'local',
        name: '原名称',
        config: { rootPath: 'E:\\media', category: 'tv' },
        createdAt: 1,
        lastScanAt: null,
        ...overrides,
    };
}

test('source update plan: id immutable, unknown fields and invalid values rejected', () => {
    const current = currentSource();
    assert.equal(planSourceUpdate(current, { id: 'src-2' }).ok, false);
    assert.equal(planSourceUpdate(current, { id: 'src-1', type: 'webdav' }).ok, false, 'type 不可修改');
    assert.equal(planSourceUpdate(current, { id: 'src-1', enabled: true }).ok, false, '未批准字段拒绝');
    assert.equal(planSourceUpdate(current, { id: 'src-1', name: '   ' }).ok, false);
    assert.equal(planSourceUpdate(current, { id: 'src-1', category: 'bogus' }).ok, false);
    assert.equal(planSourceUpdate(current, { id: 'src-1', rootPath: '' }).ok, false);
    assert.equal(planSourceUpdate(current, { id: 'src-1', url: 'https://x' }).ok, false, '本地源拒绝 url');
});

test('source update plan: local partial update keeps unrelated fields', () => {
    const current = currentSource();
    const result = planSourceUpdate(current, { id: 'src-1', name: '新名称', rootPath: 'E:\\media2', category: 'movie' });
    assert.equal(result.ok, true);
    assert.equal(result.plan.next.name, '新名称');
    assert.equal(result.plan.next.config.rootPath, 'E:\\media2');
    assert.equal(result.plan.next.config.category, 'movie');
    assert.equal(result.plan.next.type, 'local');
    assert.equal(result.plan.passwordAction, 'keep');
});

test('source update plan: webdav password tri-state keep/replace/clear', () => {
    const current = currentSource({
        type: 'webdav',
        config: { url: 'https://nas/dav', username: 'u', passwordEnc: 'safe-storage:v1:OLD', category: 'tv' },
    });

    const keep1 = planSourceUpdate(current, { id: 'src-1' });
    assert.equal(keep1.ok, true);
    assert.equal(keep1.plan.passwordAction, 'keep');
    assert.equal(keep1.plan.next.config.passwordEnc, 'safe-storage:v1:OLD');

    const keep2 = planSourceUpdate(current, { id: 'src-1', password: '' });
    assert.equal(keep2.ok, true);
    assert.equal(keep2.plan.passwordAction, 'keep');

    const replace = planSourceUpdate(current, { id: 'src-1', password: 'new-pass' });
    assert.equal(replace.ok, true);
    assert.equal(replace.plan.passwordAction, 'replace');
    assert.equal(replace.plan.replacePassword, 'new-pass');
    assert.equal(replace.plan.next.config.passwordEnc, 'safe-storage:v1:OLD', '加密在主进程执行，plan 不写明文');

    const clear = planSourceUpdate(current, { id: 'src-1', password: null });
    assert.equal(clear.ok, true);
    assert.equal(clear.plan.passwordAction, 'clear');
    assert.equal(clear.plan.next.config.passwordEnc, '');

    assert.equal(planSourceUpdate(current, { id: 'src-1', rootPath: 'E:\\x' }).ok, false, 'webdav 拒绝 rootPath');
    assert.equal(planSourceUpdate(current, { id: 'src-1', url: 'ftp://x' }).ok, false);
});

test('source update persists through the json store without plaintext password', (t) => {
    const dir = makeTmpDir('fntv-srcedit-');
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const dbPath = path.join(dir, 'db.json');
    const store = createJsonLibraryStore(dbPath);
    const source = store.addSource({
        type: 'webdav',
        name: 'NAS',
        config: { url: 'https://nas/dav', username: 'u', passwordEnc: 'safe-storage:v1:CIPHER' },
    });
    const result = planSourceUpdate(store.getSource(source.id), {
        id: source.id,
        name: 'NAS2',
        password: 'plain-secret',
    });
    assert.equal(result.ok, true);
    // 模拟 main：replace 只在主进程加密；此处直接写入固定密文
    result.plan.next.config.passwordEnc = 'safe-storage:v1:NEWCIPHER';
    store.updateSource(result.plan.next);
    store.close();

    const raw = fs.readFileSync(dbPath, 'utf-8');
    assert.ok(!raw.includes('plain-secret'), '磁盘不得出现明文密码');

    const reopened = createJsonLibraryStore(dbPath);
    try {
        const saved = reopened.getSource(source.id);
        assert.equal(saved.name, 'NAS2');
        assert.equal(saved.config.passwordEnc, 'safe-storage:v1:NEWCIPHER');
        assert.equal(saved.type, 'webdav');
    } finally {
        reopened.close();
    }
});
