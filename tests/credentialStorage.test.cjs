const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { makeTmpDir } = require('./helpers/tmpRoot.cjs');

function legacyEncrypt(value) {
    const key = Buffer.from('U2XDcFsV6rdTE9wB5ZHvy6BW9hBTKJ1H');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, Buffer.alloc(16, 0));
    return cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
}

test('migrates legacy credentials to OS-protected storage without changing returned values', () => {
    const testRoot = makeTmpDir('fntv-credentials-');
    const paths = { home: testRoot, userData: path.join(testRoot, '.fntv') };
    const electronMock = {
        app: {
            getPath(name) { return paths[name]; },
            setPath(name, value) { paths[name] = value; },
        },
        safeStorage: {
            isEncryptionAvailable() { return true; },
            encryptString(value) { return Buffer.from(`protected:${value}`, 'utf8'); },
            decryptString(value) {
                const decoded = value.toString('utf8');
                assert.match(decoded, /^protected:/);
                return decoded.slice('protected:'.length);
            },
        },
    };

    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
        if (request === 'electron') return electronMock;
        return originalLoad.call(this, request, parent, isMain);
    };

    try {
        fs.mkdirSync(paths.userData, { recursive: true });
        const configPath = path.join(paths.userData, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify({
            account: 'user',
            domain: 'https://nas.example',
            token: 'legacy-token',
            accessCode: 'legacy-access-code',
            history: [{
                domain: 'nas.example',
                account: 'user',
                password: legacyEncrypt('legacy-password'),
                accessCode: 'legacy-history-access-code',
            }],
        }));

        const configModulePath = require.resolve('../dest/modules/fn_config/config.js');
        delete require.cache[configModulePath];
        const config = require(configModulePath);
        assert.equal(config.readConfig().token, 'legacy-token');
        assert.equal(config.readConfig().accessCode, 'legacy-access-code');
        assert.equal(config.getHistory()[0].password, 'legacy-password');
        assert.equal(config.getHistory()[0].accessCode, 'legacy-history-access-code');

        const stored = fs.readFileSync(configPath, 'utf8');
        assert.doesNotMatch(stored, /legacy-token|legacy-password|legacy-access-code|legacy-history-access-code/);
        assert.match(stored, /safe-storage:v1:/);
    } finally {
        Module._load = originalLoad;
        fs.rmSync(testRoot, { recursive: true, force: true });
    }
});
