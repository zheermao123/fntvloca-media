/**
 * 隐私库端到端验收（批次 A-01）
 *
 * - 隔离数据目录（FNTV_USER_DATA_DIR，仅开发态生效），不读取真实用户数据。
 * - 自动创建测试私有媒体源与最小合法视频文件，真实走 add-source → scan → 隐私解锁 → 详情/搜索 → 锁定 → 回退/重进 → 重启。
 * - 测试密码固定且仅存在于临时文件/内存，结束后销毁临时目录。
 *
 * 前置：npm run compile（dest 产物）与 npm run renderer:build（ui2-renderer）。
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
const PRIVATE_TOKEN = /private/i;
const TMP = path.join(os.tmpdir(), 'opencode');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function writePrivateFixture(profile) {
    const mediaDir = path.join(profile, 'media');
    fs.mkdirSync(mediaDir, { recursive: true });
    const file = path.join(mediaDir, 'Private.E2E.Movie.2024.1080p.mp4');
    const buffer = Buffer.alloc(96);
    buffer.writeUInt32BE(24, 0);
    buffer.write('ftypisom', 4, 'ascii');
    buffer.write('isomiso2avc1mp41', 16, 'ascii');
    fs.writeFileSync(file, buffer);
    return mediaDir;
}

function spawnApp(profile) {
    const electronPath = require('electron');
    return spawn(electronPath, ['.', `--remote-debugging-port=${PORT}`], {
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
}

function killApp(child) {
    if (!child) {
        return;
    }
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}

async function waitExit(child, timeoutMs = 15000) {
    if (!child || child.exitCode !== null) {
        return true;
    }
    return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), timeoutMs);
        child.once('exit', () => {
            clearTimeout(timer);
            resolve(true);
        });
    });
}

async function connectApp(child) {
    const target = await waitForPageTarget();
    if (!target) {
        throw new Error('CDP 页面未就绪');
    }
    const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    return cdp;
}

async function bridgeInvoke(cdp, channel, reply, payload, timeoutMs) {
    return cdp.evaluate(`new Promise((resolve, reject) => {
        const api = window.electronAPI;
        const timer = setTimeout(() => {
            api.off(${JSON.stringify(reply)}, onReply);
            reject(new Error('bridge timeout: ${reply}'));
        }, ${timeoutMs});
        function onReply(_event, data) {
            clearTimeout(timer);
            api.off(${JSON.stringify(reply)}, onReply);
            resolve(data);
        }
        api.on(${JSON.stringify(reply)}, onReply);
        api.send(${JSON.stringify(channel)}, ${JSON.stringify(payload)});
    })`);
}

async function main() {
    const privacy = require(path.join(ROOT, 'dest', 'modules', 'library', 'privacy.js'));
    if (!fs.existsSync(path.join(ROOT, 'ui2-renderer', 'index.html'))) {
        throw new Error('缺少 ui2-renderer 构建产物，请先 npm run renderer:build');
    }

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fntv-privacy-e2e-'));
    fs.writeFileSync(
        path.join(profile, 'config.json'),
        JSON.stringify({ privacyPasswordHash: privacy.hashPrivacyPassword(PASSWORD) }, null, 2)
    );
    const mediaDir = writePrivateFixture(profile);

    const report = { profile, steps: [], ok: true };
    let child = spawnApp(profile);
    let cdp = null;

    const step = async (name, fn) => {
        try {
            report.steps.push({ name, ok: true, detail: await fn() });
        } catch (error) {
            report.ok = false;
            report.steps.push({ name, ok: false, error: error.message });
            throw error;
        }
    };

    const setPassword = (value) =>
        cdp.evaluate(`(() => {
            const input = document.querySelector('.ui-dialog input[type="password"]');
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(input, ${JSON.stringify(value)});
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return input.value;
        })()`);
    const clickUnlock = (times = 1) =>
        cdp.evaluate(`(() => {
            const btn = Array.from(document.querySelectorAll('.ui-dialog__footer button'))
                .find((item) => (item.textContent || '').trim() === '解锁');
            if (!btn) return false;
            for (let i = 0; i < ${times}; i += 1) btn.click();
            return true;
        })()`);
    const openPrivacyGate = () =>
        cdp.evaluate(`(() => {
            const btn = document.querySelector('.app-privacy button');
            if (!btn) return false;
            btn.click();
            return true;
        })()`);
    const pressEscape = () =>
        cdp.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
    const privacyLabel = () =>
        cdp.evaluate(`document.querySelector('.app-privacy button')?.textContent ?? ''`);

    try {
        cdp = await connectApp(child);

        await step('boot isolated app', async () => {
            await cdp.waitFor(`!!document.querySelector('.app-sidebar')`, 'sidebar');
            return cdp.evaluate(`document.querySelector('.app-brand__name').textContent`);
        });

        await step('seed private source and scan', async () => {
            const added = await bridgeInvoke(
                cdp,
                'library:add-source',
                'library:source-added',
                { type: 'local', name: 'E2E Private', rootPath: mediaDir, private: true },
                8000
            );
            if (!added?.source?.id) {
                throw new Error('add-source failed: ' + JSON.stringify(added));
            }
            const scan = await bridgeInvoke(cdp, 'library:scan', 'library:scan-done', {}, 60000);
            if (scan?.error) {
                throw new Error('scan failed: ' + scan.error);
            }
            return { added: scan?.added ?? 0, sourceId: added.source.id };
        });

        await step('rapid gate open keeps single dialog', async () => {
            await cdp.evaluate(`(() => {
                const btn = document.querySelector('.app-privacy button');
                btn.click(); btn.click(); btn.click();
                return true;
            })()`);
            await cdp.waitFor(`!!document.querySelector('.ui-dialog input[type="password"]')`, 'password input');
            return cdp.evaluate(`document.querySelectorAll('.ui-dialog').length`);
        });

        await step('wrong password rejected (double click)', async () => {
            await setPassword(WRONG_PASSWORD);
            await clickUnlock(2);
            await cdp.waitFor(`document.body.innerText.includes('密码错误')`, 'wrong password error', 10000);
            if (!(await cdp.evaluate(`!!document.querySelector('.ui-dialog')`))) {
                throw new Error('dialog closed on wrong password');
            }
            return 'error shown once';
        });

        await step('correct password unlocks (double click)', async () => {
            await setPassword(PASSWORD);
            await clickUnlock(2);
            await cdp.waitFor(`!document.querySelector('.ui-dialog')`, 'dialog closed', 10000);
            await cdp.waitFor(
                `(document.querySelector('.app-privacy button')?.textContent || '').includes('退出隐私模式')`,
                'privacy active label'
            );
            return 'unlocked';
        });

        let privateHref = '';
        await step('privacy library shows private fixture only', async () => {
            await cdp.evaluate(`location.hash = '#/library/movies'; true`);
            await cdp.waitFor(
                `document.querySelector('.library-page__title')?.textContent === '隐私库'`,
                'privacy library title'
            );
            await cdp.waitFor(`document.querySelectorAll('.media-card').length > 0`, 'private card');
            const info = await cdp.evaluate(`({
                count: document.querySelectorAll('.media-card').length,
                title: document.querySelector('.media-card__name')?.textContent ?? '',
                href: document.querySelector('.media-card')?.getAttribute('href') ?? ''
            })`);
            if (!PRIVATE_TOKEN.test(info.title)) {
                throw new Error('fixture title missing: ' + info.title);
            }
            privateHref = info.href;
            return info;
        });

        await step('private detail opens while unlocked', async () => {
            await cdp.evaluate(`location.hash = ${JSON.stringify(privateHref)}; true`);
            await cdp.waitFor(`!!document.querySelector('.detail-page')`, 'detail page');
            const title = await cdp.evaluate(
                `document.querySelector('.detail-hero__title')?.textContent ?? ''`
            );
            if (!PRIVATE_TOKEN.test(title)) {
                throw new Error('private detail title missing: ' + title);
            }
            return title;
        });

        await step('private search works in privacy mode', async () => {
            await cdp.evaluate(
                `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); true`
            );
            await cdp.waitFor(`!!document.querySelector('.ui-dialog input')`, 'search dialog');
            await cdp.evaluate(`(() => {
                const input = document.querySelector('.ui-dialog input');
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(input, 'Private');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()`);
            await cdp.waitFor(`document.querySelectorAll('.ui-dialog .media-card').length > 0`, 'private search result');
            const results = await cdp.evaluate(`document.querySelectorAll('.ui-dialog .media-card').length`);
            await pressEscape();
            await cdp.waitFor(`!document.querySelector('.ui-dialog')`, 'search closed');
            return results;
        });

        await step('lock returns home and clears privacy UI', async () => {
            await cdp.evaluate(`location.hash = '#/library/movies'; true`);
            await cdp.waitFor(
                `document.querySelector('.library-page__title')?.textContent === '隐私库'`,
                'back to privacy library'
            );
            await cdp.evaluate(`document.querySelector('.app-privacy button').click(); true`);
            await cdp.waitFor(`location.hash === '#/home'`, 'redirect home');
            await cdp.waitFor(
                `(document.querySelector('.app-privacy button')?.textContent || '').includes('进入隐私模式')`,
                'privacy inactive label'
            );
            if (await cdp.evaluate(`!!document.querySelector('.ui-dialog')`)) {
                throw new Error('dialog open after lock');
            }
            return 'locked';
        });

        await step('history back cannot restore private content', async () => {
            await cdp.evaluate(`history.back(); true`);
            await sleep(1200);
            const info = await cdp.evaluate(`({
                hash: location.hash,
                body: document.body.innerText,
                detailTitle: document.querySelector('.detail-hero__title')?.textContent ?? null
            })`);
            if (PRIVATE_TOKEN.test(info.body)) {
                throw new Error('private content visible after history back');
            }
            return { hash: info.hash, detailTitle: info.detailTitle };
        });

        await step('direct private route is gated while locked', async () => {
            await cdp.evaluate(`location.hash = ${JSON.stringify(privateHref)}; true`);
            await sleep(1500);
            const info = await cdp.evaluate(`({
                body: document.body.innerText,
                error: !!document.querySelector('.ui-error-state'),
                detailTitle: document.querySelector('.detail-hero__title')?.textContent ?? null
            })`);
            if (PRIVATE_TOKEN.test(info.body) || (info.detailTitle && PRIVATE_TOKEN.test(info.detailTitle))) {
                throw new Error('private detail reachable while locked');
            }
            return info;
        });

        await step('locked search has no private results', async () => {
            await cdp.evaluate(
                `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })); true`
            );
            await cdp.waitFor(`!!document.querySelector('.ui-dialog input')`, 'search dialog');
            await cdp.evaluate(`(() => {
                const input = document.querySelector('.ui-dialog input');
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(input, 'Private');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            })()`);
            await sleep(1500);
            const info = await cdp.evaluate(`({
                results: document.querySelectorAll('.ui-dialog .media-card').length,
                empty: !!document.querySelector('.ui-dialog .ui-empty-state'),
                body: document.querySelector('.ui-dialog')?.innerText ?? ''
            })`);
            if (info.results > 0 || PRIVATE_TOKEN.test(info.body)) {
                throw new Error('private search results leaked while locked');
            }
            await pressEscape();
            await cdp.waitFor(`!document.querySelector('.ui-dialog')`, 'search closed');
            return info;
        });

        await step('public library stays empty for private-only fixture', async () => {
            await cdp.evaluate(`location.hash = '#/library/movies'; true`);
            await cdp.waitFor(
                `document.querySelector('.library-page__title')?.textContent === '电影'`,
                'public library title'
            );
            await sleep(1200);
            const info = await cdp.evaluate(`({
                cards: document.querySelectorAll('.media-card').length,
                body: document.body.innerText,
                sample: Array.from(document.querySelectorAll('.media-card')).slice(0, 3).map((el) => ({
                    connected: el.isConnected,
                    text: el.textContent,
                    parent: el.parentElement?.className ?? null,
                    html: el.outerHTML.slice(0, 160)
                }))
            })`);
            if (info.cards !== 0 || PRIVATE_TOKEN.test(info.body)) {
                throw new Error('private fixture leaked into public library: ' + JSON.stringify(info));
            }
            return info;
        });

        await step('restart keeps privacy locked and gated', async () => {
            killApp(child);
            await waitExit(child);
            child = spawnApp(profile);
            cdp = await connectApp(child);
            await cdp.waitFor(`!!document.querySelector('.app-sidebar')`, 'sidebar after restart');
            const label = await privacyLabel();
            if (!label.includes('进入隐私模式')) {
                throw new Error('privacy unlocked after restart: ' + label);
            }
            await cdp.evaluate(`location.hash = ${JSON.stringify(privateHref)}; true`);
            await sleep(1500);
            const body = await cdp.evaluate(`document.body.innerText`);
            if (PRIVATE_TOKEN.test(body)) {
                throw new Error('private content visible after restart');
            }
            return { label };
        });

        await step('close during unlock keeps privacy locked after restart', async () => {
            await cdp.evaluate(`location.hash = '#/home'; true`);
            await cdp.waitFor(`!!document.querySelector('.app-privacy button')`, 'home privacy button');
            await openPrivacyGate();
            await cdp.waitFor(`!!document.querySelector('.ui-dialog input[type="password"]')`, 'gate re-opened');
            await setPassword(WRONG_PASSWORD);
            await clickUnlock(1);
            void cdp.send('Browser.close').catch(() => undefined);
            const exited = await waitExit(child, 5000);
            if (!exited) {
                killApp(child);
                await waitExit(child);
            }
            child = spawnApp(profile);
            cdp = await connectApp(child);
            await cdp.waitFor(`!!document.querySelector('.app-sidebar')`, 'sidebar after close');
            const label = await privacyLabel();
            if (!label.includes('进入隐私模式')) {
                throw new Error('privacy unlocked after close-during-unlock: ' + label);
            }
            await cdp.evaluate(`location.hash = ${JSON.stringify(privateHref)}; true`);
            await sleep(1200);
            const body = await cdp.evaluate(`document.body.innerText`);
            if (PRIVATE_TOKEN.test(body)) {
                throw new Error('private content visible after close-during-unlock');
            }
            return { label };
        });

        report.screenshot = await cdp.screenshot('ui2-privacy-e2e.png');
        cdp.ws.close();
    } catch (error) {
        report.ok = false;
        report.error = error.message;
        if (cdp) {
            try {
                report.failureScreenshot = await cdp.screenshot('ui2-privacy-e2e-failure.png');
            } catch {
                /* ignore */
            }
        }
    } finally {
        killApp(child);
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
    console.error('E2E FAILED:', error);
    process.exit(1);
});
