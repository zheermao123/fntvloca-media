/**
 * B-01 大库分页真实 Electron 验收（合成 17k 电影 + 500 剧 × 8 集）
 * - 隔离 FNTV_USER_DATA_DIR，不触碰真实用户库
 * - 启动 file:// React 构建，验证首屏、加载更多、总数、重复检测与 DOM 规模
 *
 * 前置：npm run compile && npm run renderer:build
 * 用法：node scripts/phase3-large-library-check.cjs
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 9225;
const MOVIES = Number(process.env.BENCH_MOVIES ?? 17000);
const SHOWS = Number(process.env.BENCH_SHOWS ?? 500);
const EPISODES = Number(process.env.BENCH_EPISODES ?? 8);
const TMP = path.join(os.tmpdir(), 'opencode');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function seedLibrary(profile) {
    const dbDir = path.join(profile, 'library');
    fs.mkdirSync(dbDir, { recursive: true });
    const { createLibraryStore } = require(path.join(ROOT, 'dest', 'modules', 'library', 'store.js'));
    const store = createLibraryStore(dbDir);
    const movieSource = store.addSource({
        type: 'local',
        name: 'Bench Movies',
        config: { rootPath: 'E:\\bench', category: 'movie' },
    });
    for (let i = 0; i < MOVIES; i += 1) {
        store.upsertItem({
            sourceId: movieSource.id,
            kind: 'movie',
            title: `Bench Movie ${String(i).padStart(5, '0')}`,
            year: 1990 + (i % 35),
            filePath: `E:\\bench\\movies\\m${i}.mp4`,
            fileSize: 1024,
            resolution: '1080p',
        });
    }
    const tvSource = store.addSource({
        type: 'local',
        name: 'Bench TV',
        config: { rootPath: 'E:\\bench-tv', category: 'tv' },
    });
    for (let s = 0; s < SHOWS; s += 1) {
        const { show } = store.upsertShow({
            sourceId: tvSource.id,
            groupKey: `bench-show-${s}`,
            title: `Bench Show ${String(s).padStart(4, '0')}`,
            year: 2000 + (s % 25),
        });
        for (let e = 1; e <= EPISODES; e += 1) {
            store.upsertItem({
                sourceId: tvSource.id,
                kind: 'episode',
                showId: show.id,
                title: `Bench Show ${s}`,
                season: 1,
                episode: e,
                filePath: `E:\\bench-tv\\s${s}\\e${e}.mkv`,
                fileSize: 1024,
                resolution: '1080p',
            });
        }
    }
    store.close?.();
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
                message.error ? reject(new Error(message.error.message)) : resolve(message.result);
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

    async waitFor(expression, label, timeoutMs = 30000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const value = await this.evaluate(expression).catch(() => null);
            if (value) {
                return value;
            }
            await sleep(200);
        }
        throw new Error(`waitFor timeout: ${label}`);
    }
}

async function main() {
    if (!fs.existsSync(path.join(ROOT, 'ui2-renderer', 'index.html'))) {
        throw new Error('缺少 ui2-renderer 构建，请先 npm run renderer:build');
    }
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fntv-large-e2e-'));
    const seedStart = Date.now();
    seedLibrary(profile);
    const seedMs = Date.now() - seedStart;

    const electronPath = require('electron');
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

    const report = { fixture: { movies: MOVIES, shows: SHOWS, episodes: EPISODES }, seedMs, steps: [], ok: true };
    let cdp = null;
    try {
        let target = null;
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            try {
                const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
                target = pages.find((item) => item.type === 'page');
                if (target) {
                    break;
                }
            } catch {
                /* retry */
            }
            await sleep(500);
        }
        if (!target) {
            throw new Error('CDP 页面未就绪');
        }
        cdp = await Cdp.connect(target.webSocketDebuggerUrl);
        await cdp.send('Runtime.enable');
        await cdp.send('Page.enable');

        await cdp.waitFor(`!!document.querySelector('.app-sidebar')`, 'sidebar');

        const firstPageMs = await cdp.evaluate(`new Promise((resolve) => {
            const start = performance.now();
            const check = () => {
                if (document.querySelectorAll('.media-card').length === 120) {
                    resolve(performance.now() - start);
                    return;
                }
                requestAnimationFrame(check);
            };
            location.hash = '#/library/movies';
            requestAnimationFrame(check);
        })`);
        await cdp.waitFor(`document.querySelectorAll('.media-card').length === 120`, 'first page 120 cards');
        const firstInfo = await cdp.evaluate(`({
            cards: document.querySelectorAll('.media-card').length,
            count: document.querySelector('.library-page__count')?.textContent ?? '',
            domNodes: document.getElementsByTagName('*').length,
            heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
            more: document.querySelector('.library-page__more button')?.textContent ?? null
        })`);

        const pages = [];
        for (let page = 2; page <= 4; page += 1) {
            const ms = await cdp.evaluate(`new Promise((resolve) => {
                const start = performance.now();
                const check = () => {
                    if (document.querySelectorAll('.media-card').length === ${page * 120}) {
                        resolve(performance.now() - start);
                        return;
                    }
                    requestAnimationFrame(check);
                };
                document.querySelector('.library-page__more button')?.click();
                requestAnimationFrame(check);
            })`);
            await cdp.waitFor(`document.querySelectorAll('.media-card').length === ${page * 120}`, `page ${page}`);
            pages.push({ page, cards: page * 120, ms });
        }

        const afterInfo = await cdp.evaluate(`(() => {
            const names = Array.from(document.querySelectorAll('.media-card__name')).map((el) => el.textContent);
            return {
                cards: names.length,
                unique: new Set(names).size,
                count: document.querySelector('.library-page__count')?.textContent ?? '',
                domNodes: document.getElementsByTagName('*').length,
                heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
                more: document.querySelector('.library-page__more button')?.textContent ?? null
            };
        })()`);

        report.steps.push({ name: 'first page', ok: true, ms: firstPageMs, ...firstInfo });
        report.steps.push({ name: 'load more', ok: true, pages });
        report.steps.push({ name: 'paged result integrity', ok: true, ...afterInfo });
        if (afterInfo.cards !== afterInfo.unique) {
            throw new Error('duplicate cards across pages');
        }
        if (!String(firstInfo.count).includes('17000')) {
            throw new Error('total count mismatch: ' + firstInfo.count);
        }
    } catch (error) {
        report.ok = false;
        report.error = error.message;
    } finally {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        try {
            fs.rmSync(profile, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }

    fs.mkdirSync(TMP, { recursive: true });
    const file = path.join(TMP, 'phase3-large-library-result.json');
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`RESULT_FILE=${file}`);
    process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
    console.error('large library check failed:', error);
    process.exit(1);
});
