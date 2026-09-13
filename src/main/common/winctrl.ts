import * as path from 'path';
import * as log from '../../modules/logger';
import { readConfig, saveConfig } from '../../modules/fn_config/config';
import { restoreCookies } from '../../modules/fn_config/cookie';
import { BrowserWindow, dialog } from 'electron';
import { AccessCodeVerificationError, establishAccessCodeSession } from './accessCodeSession';
import { applyVerifiedOriginToFnConnectBaseUrl } from '../handlers/core/fnConnect';

/**
 * 设置窗口为半屏
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
export function setHalfScreen(mainWindow: BrowserWindow): void {
    if (!mainWindow) return;

    mainWindow.setSize(1200, 800);
    mainWindow.center();
    mainWindow.unmaximize();
}

/**
 * 设置窗口为全屏
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
export function setFullScreen(mainWindow: BrowserWindow): void {
    if (mainWindow) mainWindow.maximize();
}

/**
 * 设置全屏切换
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
export function setupFullScreenToggle(mainWindow: BrowserWindow): void {
    let isFullScreen = false;
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            if (isFullScreen) {
                setHalfScreen(mainWindow);
            } else {
                setFullScreen(mainWindow);
            }
            isFullScreen = !isFullScreen;
            event.preventDefault();
        }
    });
}

/**
 * 设置输入法相关功能
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
export function setupInputMethodDisable(mainWindow: BrowserWindow): void {
    // 禁用输入法相关功能
    mainWindow.webContents.on('dom-ready', () => {
        // 注入CSS来禁用输入法自动切换
        mainWindow.webContents.insertCSS(`
            * {
                ime-mode: disabled !important;
                -webkit-ime-mode: disabled !important;
            }
            input, textarea {
                ime-mode: inactive !important;
                -webkit-ime-mode: inactive !important;
            }
        `);
    });
}

/**
 * 设置窗口显示事件
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
export function setupWindowShowEvents(mainWindow: BrowserWindow): void {
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

/**
 * 加载本地媒体库页面（统一入口）
 * fnOS 自动登录恢复逻辑保留在 setupFnosAutoLogin 中，供 fnOS 源适配阶段复用。
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
export function loadLibraryPage(mainWindow: BrowserWindow): void {
    log.info('加载本地媒体库页面');
    mainWindow.loadFile(path.join(__dirname, '../../../resource/library/index.html'));
}

/**
 * fnOS 自动登录恢复（延迟启用，fnOS 源适配阶段重新启用）
 */
export async function setupFnosAutoLogin(mainWindow: BrowserWindow): Promise<void> {
    // 从配置中恢复 cookie
    let savedConfig;
    try {
        savedConfig = readConfig();
    } catch (error) {
        const message = error instanceof Error ? error.message : '无法读取安全配置';
        log.error('读取安全配置失败:', error);
        await dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: '安全存储不可用',
            message,
            detail: '请启用操作系统密钥环后重新登录。已有配置不会被明文降级。',
        });
        mainWindow.loadFile(path.join(__dirname, '../../../resource/login/index.html'));
        return;
    }
    if (!savedConfig || !savedConfig.token || !savedConfig.domain) {
        log.warn('没有找到已保存的配置，无法恢复 cookie');
        mainWindow.loadFile(path.join(__dirname, '../../../resource/login/index.html'));
        return;
    }

    if (savedConfig.accessCode) {
        try {
            const accessSession = await establishAccessCodeSession(savedConfig.domain, savedConfig.accessCode);
            const resolvedBaseUrl = applyVerifiedOriginToFnConnectBaseUrl(
                savedConfig.domain,
                accessSession.baseUrl,
            );
            if (resolvedBaseUrl !== savedConfig.domain) {
                savedConfig.domain = resolvedBaseUrl;
                savedConfig.useHttps = resolvedBaseUrl.startsWith('https://');
                saveConfig({
                    account: savedConfig.account || '',
                    domain: savedConfig.domain,
                    token: savedConfig.token,
                    accessCode: savedConfig.accessCode,
                    useHttps: savedConfig.useHttps,
                });
            }
        } catch (error) {
            const reason = error instanceof AccessCodeVerificationError ? error.reason : 'network';
            log.warn('恢复访问码会话失败:', reason);
            mainWindow.loadFile(path.join(__dirname, '../../../resource/login/index.html'));
            return;
        }
    }

    // 恢复 cookie 并跳转到对应的 URL
    log.info('恢复登录状态，即将跳转到主页面, domain:', savedConfig.domain);

    // 恢复 cookie
    await restoreCookies(savedConfig.domain, savedConfig.token).then((result) => {
        if (result === true) {
            // cookie 恢复成功，跳转到主页面
            mainWindow.loadURL(`${savedConfig.domain}/v`);
            return;
        }

        // cookie 恢复失败，跳转到登录页面
        log.warn('Cookie 恢复失败，跳转到登录页面');
        mainWindow.loadFile(path.join(__dirname, '../../../resource/login/index.html'));
    }).catch((error) => {
        // 出现异常，也跳转到登录页面
        log.error('Cookie 恢复过程中出现异常:', error);
        mainWindow.loadFile(path.join(__dirname, '../../../resource/login/index.html'));
    });
}
