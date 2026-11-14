import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * UI 2.0 React renderer 构建配置。
 * - 源码根目录：src/renderer（与 main/preload 的 tsc 构建完全隔离）
 * - 生产产物：仓库根目录 ui2-renderer/（file:// 相对路径，不进 dest，不覆盖 resource/library）
 */

const PRODUCTION_CSP =
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' file: data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'";
// 开发期最小例外：仅固定 loopback 的 HMR websocket
const DEVELOPMENT_CSP =
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' file: data:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:5273; object-src 'none'; base-uri 'none'";

function devCspOverride(): Plugin {
    return {
        name: 'ui2-dev-csp-override',
        apply: 'serve',
        transformIndexHtml(html: string) {
            return html.replace(PRODUCTION_CSP, DEVELOPMENT_CSP);
        },
    };
}

export default defineConfig({
    root: 'src/renderer',
    base: './',
    plugins: [react(), devCspOverride()],
    build: {
        outDir: '../../ui2-renderer',
        emptyOutDir: true,
        sourcemap: false,
    },
});
