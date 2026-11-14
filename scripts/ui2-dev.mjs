/**
 * UI 2.0 开发启动器（P1-03）。
 *
 * 流程：启动固定 loopback Vite dev server（127.0.0.1:5273，strictPort）→
 * 等待 server ready → 以 FNTV_UI_SHELL=react 启动 Electron →
 * Electron 退出时关闭 Vite dev server 并退出本进程。
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HOST = '127.0.0.1';
const PORT = 5273;
const DEV_URL = `http://${HOST}:${PORT}`;

async function main() {
    const server = await createServer({
        configFile: path.join(repoRoot, 'vite.config.ts'),
        server: { host: HOST, port: PORT, strictPort: true },
    });
    await server.listen();
    console.log(`[ui2-dev] Vite dev server ready: ${DEV_URL}`);

    const child = spawn(electronPath, ['.'], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: {
            ...process.env,
            FNTV_UI_SHELL: 'react',
            FNTV_UI2_DEV_URL: DEV_URL,
        },
    });

    let closed = false;
    const shutdown = async (code) => {
        if (closed) {
            return;
        }
        closed = true;
        try {
            await server.close();
        } catch {
            // 忽略关闭失败
        }
        process.exit(code);
    };

    child.on('exit', (code) => {
        void shutdown(typeof code === 'number' ? code : 0);
    });
    child.on('error', (error) => {
        console.error('[ui2-dev] Electron 启动失败:', error);
        void shutdown(1);
    });
    for (const signal of ['SIGINT', 'SIGTERM']) {
        process.on(signal, () => {
            if (!child.killed) {
                child.kill();
            }
        });
    }
}

main().catch((error) => {
    console.error('[ui2-dev] 启动失败:', error);
    process.exit(1);
});
