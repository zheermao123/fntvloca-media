/**
 * 隐私模式端到端验证（隔离 USERPROFILE，不触碰真实 ~/.fntv）
 *
 * 前置：npm run compile（需要 dest/modules/library/privacy.js）与 ui2-renderer 构建。
 * 用法：node scripts/ui2-privacy-e2e.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 9224;
const PASSWORD = 'E2E-Pass-123';
const WRONG_PASSWORD = 'wrong-pass';
const TMP = path.join(os.tmpdir(), 'opencode');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message) {
    console.error('E2E FAILED:', message);
    process.exit(1);
}

async function waitForPageTarget(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
            const page = pages.find((item) => item.type === 'page');
            if (page && page.webSocketDebuggerUrl) {
                return page;
            }
        } catch {
            /* retry */
        }
        await sleep(500);
    }
    return null;
}

class Cdp {
    constructor(ws) {
        this.ws = ws;
        this.id = 0;
        this.pending = new Map();
        ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.id && this.pending.has(message.id)) {
                const { resolve, reject } = this.pending.get(message.id);
                this.pending.delete(message.id);
                if (message.error) {
                    reject(new Error(message.error.message));
                } else {
                    resolve(message.result);
                }
            }
        });
    }

    static async connect(url) {
        const ws = new WebSocket(url);
        await new Promise((resolve, reject) => {
            ws.addEventListener('open', resolve, { once: true });
            ws.addEventListener('error', reject, { once: true });
        });
        return new Cdp(ws);
    }

    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
            userGesture: true,
        });
        if (result.exceptionDetails) {
            throw new Error(result.exceptionDetails.exception?.description || 'evaluate exception');
        }
        return result.result.value;
    }

    async waitFor(expression, label, timeoutMs = 15000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const value = await this.evaluate(expression).catch(() => null);
            if (value) {
                return value;
            }
            await sleep(300);
        }
        throw new Error(`waitFor timeout: ${label}`);
    }

    async screenshot(name) {
        const result = await this.send('Page.captureScreenshot', { format: 'png' });
        fs.mkdirSync(TMP, { recursive: true });
        const file = path.join(TMP, name);
        fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
        return file;
    }
}

async function main() {
    const privacy = require(path.join(ROOT, 'dest', 'modules', 'library', 'privacy.js'));
    const electronPath = require('electron');
    if (!fs.existsSync(path.join(ROOT, 'ui2-renderer', 'index.html'))) {
        fail('缺少 ui2-renderer 构建产物，请先 npm run renderer:build');
    }

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fntv-privacy-e2e-'));
    const configDir = profile;
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({ privacyPasswordHash: privacy.hashPrivacyPassword(PASSWORD) }, null, 2)
    );

    const child = spawn(electronPath, ['.', `--remote-debugging-port=${PORT}`], {
        cwd: ROOT,
        env: {
            ...process.env,
            USERPROFILE: profile,
            HOME: profile,
            FNTV_USER_DATA_DIR: profile,
            FNTV_UI_SHELL: 'react',
            FNTV_UI2_DEV_URL: '',
        },
        stdio: 'ignore',
    });

    const report = { profile, steps: [], ok: true };
    const step = async (name, fn) => {
        try {
            report.steps.push({ name, ok: true, detail: await fn() });
        } catch (error) {
            report.ok = false;
            report.steps.push({ name, ok: false, error: error.message });
            throw error;
        }
    };

    try {
        const target = await waitForPageTarget();
        if (!target) {
            fail('CDP 页面未就绪');
        }
        const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');

        await step('boot', async () => {
            await cdp.waitFor(`!!document.querySelector('.app-sidebar')`, 'sidebar');
            return cdp.evaluate(`document.querySelector('.app-brand__name').textContent`);
        });

        await step('open privacy gate', async () => {
            const clicked = await cdp.evaluate(`(() => {
                const btn = document.querySelector('.app-privacy button');
                if (!btn) return false;
                btn.click();
                return true;
            })()`);
            if (!clicked) {
                throw new Error('privacy button not found');
            }
            await cdp.waitFor(`!!document.querySelector('.ui-dialog input[type="password"]')`, 'password input');
            return cdp.evaluate(`document.querySelector('.ui-dialog__title')?.textContent ?? ''`);
        });

        const setPassword = (value) =>
            cdp.evaluate(`(() => {
                const input = document.querySelector('.ui-dialog input[type="password"]');
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(input, ${JSON.stringify(value)});
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return input.value;
            })()`);
        const clickUnlock = () =>
            cdp.evaluate(`(() => {
                const btn = Array.from(document.querySelectorAll('.ui-dialog__footer button'))
                    .find((item) => (item.textContent || '').trim() === '解锁');
                if (!btn) return false;
                btn.click();
                return true;
            })()`);

        await step('wrong password rejected', async () => {
            await setPassword(WRONG_PASSWORD);
            await clickUnlock();
            await cdp.waitFor(`document.body.innerText.includes('密码错误')`, 'wrong password error', 10000);
            return 'error shown';
        });

        await step('correct password unlocks privacy mode', async () => {
            await setPassword(PASSWORD);
            const value = await cdp.evaluate(
                `document.querySelector('.ui-dialog input[type="password"]')?.value ?? '<missing>'`
            );
            const clicked = await clickUnlock();
            try {
                await cdp.waitFor(`!document.querySelector('.ui-dialog')`, 'dialog closed', 10000);
            } catch (error) {
                const diagnostics = await cdp.evaluate(`({
                    value: document.querySelector('.ui-dialog input[type="password"]')?.value ?? null,
                    error: document.querySelector('.ui-dialog .ui-field__error')?.textContent ?? null,
                    buttonDisabled: Array.from(document.querySelectorAll('.ui-dialog__footer button')).map((b) => ({ text: b.textContent.trim(), disabled: b.disabled })),
                    sidebar: document.querySelector('.app-privacy button')?.textContent ?? null,
                    title: document.querySelector('.ui-dialog__title')?.textContent ?? null
                })`);
                console.error('unlock diagnostics:', JSON.stringify({ value, clicked, ...diagnostics }, null, 2));
                await cdp.screenshot('ui2-privacy-e2e-failure.png');
                throw error;
            }
            await cdp.waitFor(
                `(document.querySelector('.app-privacy button')?.textContent || '').includes('退出隐私模式')`,
                'privacy active label'
            );
            return 'unlocked';
        });

        await step('privacy library is isolated', async () => {
            await cdp.evaluate(`location.hash = '#/library/movies'; true`);
            await cdp.waitFor(
                `document.querySelector('.library-page__title')?.textContent === '隐私库'`,
                'privacy library title'
            );
            await cdp.waitFor(`!!document.querySelector('.ui-empty-state')`, 'privacy empty state');
            return cdp.evaluate(`document.querySelector('.library-page__count')?.textContent ?? ''`);
        });

        await step('exit privacy returns home', async () => {
            await cdp.evaluate(`document.querySelector('.app-privacy button').click(); true`);
            await cdp.waitFor(`location.hash === '#/home'`, 'redirect to home');
            await cdp.waitFor(
                `(document.querySelector('.app-privacy button')?.textContent || '').includes('进入隐私模式')`,
                'privacy inactive label'
            );
            if (await cdp.evaluate(`!!document.querySelector('.ui-dialog')`)) {
                throw new Error('dialog should be closed after exit');
            }
            return cdp.evaluate(`location.hash`);
        });

        await step('public view has no privacy title', async () => {
            await cdp.evaluate(`location.hash = '#/library/movies'; true`);
            await cdp.waitFor(
                `document.querySelector('.library-page__title')?.textContent === '电影'`,
                'public library title'
            );
            return 'public view restored';
        });

        report.screenshot = await cdp.screenshot('ui2-privacy-e2e.png');
        cdp.ws.close();
        report.ok = report.steps.every((item) => item.ok);
    } catch (error) {
        report.ok = false;
        report.error = error.message;
    } finally {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        if (!process.env.E2E_KEEP_PROFILE) {
            try {
                fs.rmSync(profile, { recursive: true, force: true });
            } catch {
                /* ignore */
            }
        }
    }

    fs.mkdirSync(TMP, { recursive: true });
    const resultFile = path.join(TMP, 'privacy-e2e-result.json');
    fs.writeFileSync(resultFile, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`RESULT_FILE=${resultFile}`);
    process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
    fail(error.stack || String(error));
});
