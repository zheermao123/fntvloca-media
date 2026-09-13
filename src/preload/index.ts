import * as fs from 'fs';
import * as path from 'path';
import { contextBridge, ipcRenderer, shell } from 'electron';

import { HookType, runHooks } from './core/hooks';

// 导入渲染进程日志模块
import preloadLogger from './core/logger';

const SEND_CHANNELS = new Set([
    'login', 'delete-history-item', 'clear-history', 'get-config',
    'get-version', 'check-update', 'get-download-proxy', 'get-play-button-config',
    'set-download-proxy', 'set-play-button-config',
    'play-library-item',
    'window-minimize', 'window-maximize', 'window-close',
    'library:pick-folder', 'library:add-source', 'library:list-sources',
    'library:remove-source', 'library:scan', 'library:items', 'library:item',
    'library:continue', 'library:set-watched', 'library:scrape',
    'library:scrape-status', 'library:settings-get', 'library:settings-set',
    'library:scrape-item',
]);
const RECEIVE_CHANNELS = new Set([
    'config-data', 'history-item-deleted', 'login-error', 'login-success',
    'version-info', 'update-status', 'download-proxy-info', 'play-button-config-info',
    'download-proxy-set', 'play-button-config-set',
    'library:pick-folder-result', 'library:source-added', 'library:sources-info',
    'library:source-removed', 'library:scan-done', 'library:items-info',
    'library:item-info', 'library:continue-info', 'library:watched-set',
    'library:scrape-started', 'library-scrape-progress', 'library-scrape-done',
    'library:settings-info', 'library:settings-set',
]);
type PageListener = (...args: unknown[]) => void;
const listenerWrappers = new Map<string, Map<PageListener, (...args: unknown[]) => void>>();

function assertAllowed(channels: Set<string>, channel: string): void {
    if (!channels.has(channel)) throw new Error(`IPC channel not allowed: ${channel}`);
}

function wrapListener(channel: string, listener: PageListener): (...args: unknown[]) => void {
    const wrapped = (_event: unknown, ...args: unknown[]) => listener(undefined, ...args);
    let channelListeners = listenerWrappers.get(channel);
    if (!channelListeners) {
        channelListeners = new Map();
        listenerWrappers.set(channel, channelListeners);
    }
    channelListeners.set(listener, wrapped);
    return wrapped;
}

function exposeLoginPageApi(): void {
    if (window.location.protocol !== 'file:') return;

    const api = {
        send(channel: string, ...args: unknown[]) {
            assertAllowed(SEND_CHANNELS, channel);
            ipcRenderer.send(channel, ...args);
        },
        on(channel: string, listener: PageListener) {
            assertAllowed(RECEIVE_CHANNELS, channel);
            ipcRenderer.on(channel, wrapListener(channel, listener));
        },
        once(channel: string, listener: PageListener) {
            assertAllowed(RECEIVE_CHANNELS, channel);
            ipcRenderer.once(channel, wrapListener(channel, listener));
        },
        off(channel: string, listener: PageListener) {
            assertAllowed(RECEIVE_CHANNELS, channel);
            const wrapped = listenerWrappers.get(channel)?.get(listener);
            if (!wrapped) return;
            ipcRenderer.off(channel, wrapped);
            listenerWrappers.get(channel)?.delete(listener);
        },
        async openExternal(url: string) {
            const target = new URL(url);
            if (target.protocol !== 'https:' || target.hostname !== 'github.com') {
                throw new Error('仅允许打开 GitHub HTTPS 链接');
            }
            await shell.openExternal(target.toString());
        },
    };

    contextBridge.exposeInMainWorld('electronAPI', api);
    contextBridge.exposeInMainWorld('log', preloadLogger);
    contextBridge.exposeInMainWorld('logger', preloadLogger);
}

exposeLoginPageApi();

// 自动加载插件
const pluginsDir = path.join(__dirname, 'plugins');
fs.readdirSync(pluginsDir).forEach((file: string) => {
    if (file.endsWith('.js')) {
        require(path.join(pluginsDir, file));
    }
});

function initInjector(): void {
    if (document.readyState !== 'loading') {
        runHooks(HookType.OnReady);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            runHooks(HookType.OnReady);
            const observer = new MutationObserver(() => runHooks(HookType.OnDomChange));
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
}

initInjector();
