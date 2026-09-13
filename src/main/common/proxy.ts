import { app, BrowserWindow, dialog, Notification } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { registerAllPlugins } from '../handlers';
import { getInstance as getUpdateChecker } from '../../modules/updater/updateChecker';
import * as winctrl from './winctrl';
import { createTray, showTrayNotification, destroyTray } from './tray';
import { getMacCloseAction, setMacCloseAction, getTrayNotificationShown, setTrayNotificationShown } from './preferences';
import * as log from '../../modules/logger';
import { getDaemonInstance, ProxyDaemon } from './proxyDaemon';
import { PROXY_PORT, probeProxyHealth, waitForProxyHealth } from './proxyHealth';
import { loadOrCreateProxySecret } from './proxySecret';


// 全局守护程序实例
let proxyDaemon: ProxyDaemon | null = null;
let restartScheduled = false;
let startPromise: Promise<ChildProcess | null> | null = null;
const PROXY_RESTART_DELAY_MS = 3000;
const MAX_PROXY_RESTART_ATTEMPTS = 5;
let proxySecret: string | null = null;

export function getProxySecret(): string {
    if (!proxySecret) {
        proxySecret = loadOrCreateProxySecret(app.getPath('userData'));
    }
    return proxySecret;
}

function getProxyEnvironment(): NodeJS.ProcessEnv {
    return { ...process.env, LANG: 'C.UTF-8' };
}

function sendProxySecret(proxyProcess: ChildProcess, secret: string): void {
    if (!proxyProcess.stdin) throw new Error('Proxy 标准输入不可用，无法安全传递认证密钥');
    proxyProcess.stdin.end(secret + '\n');
}

// 获取应用中的proxy可执行文件路径
function getProxyExecPath(): string {
    // 检查是否在开发环境（未打包）
    if (!app.isPackaged) {
        // 未打包时使用相对路径
        return process.platform === 'win32' 
            ? ".\\third_party\\proxy\\proxy.exe"
            : "./third_party/proxy/proxy";
    }

    // 已打包情况下的路径处理
    if (process.platform === 'darwin') {
        // macOS: third_party目录在应用包的Contents目录下，而不是在app.asar内
        const appPath = app.getAppPath();
        const contentsPath = path.dirname(path.dirname(appPath)); // 从app.asar向上两级到Contents
        return path.join(contentsPath, 'third_party', 'proxy', 'proxy');
    } else if (process.platform === 'win32') {
        return ".\\third_party\\proxy\\proxy.exe";
    } else {
        // Linux: 构建时只复制了proxy目录内容到third_party/proxy
        const appPath = app.getAppPath();
        const contentsPath = path.dirname(path.dirname(appPath));
        return path.join(contentsPath, 'third_party', 'proxy', 'proxy');
    }
}

// 启动proxy模块的函数
export function startProxyProcess(): Promise<ChildProcess | null> {
    if (!startPromise) {
        startPromise = startProxyProcessOnce().finally(() => {
            startPromise = null;
        });
    }
    return startPromise;
}

async function startProxyProcessOnce(): Promise<ChildProcess | null> {
    const proxyPath = getProxyExecPath();
    const proxySecret = getProxySecret();

    // 检查可执行文件是否存在
    if (!fs.existsSync(proxyPath)) {
        const errorMsg = `Proxy可执行文件不存在`;
        const detailMsg = `文件路径: ${proxyPath}\n\n请确保已正确编译proxy模块。\n编译命令: npm run build:proxy`;
        log.error(errorMsg + ': ' + proxyPath);
        dialog.showErrorBox('启动失败 - 文件不存在', errorMsg + '\n\n' + detailMsg);
        throw new Error(errorMsg);
    }

    try {
        // 上次异常退出可能留下仍可用的 Proxy。只复用通过协议健康检查的实例，
        // 不把任意占用 22345 端口的进程误认为本应用服务。
        if (await probeProxyHealth(proxySecret)) {
            log.warn(`检测到已运行的 fntv Proxy，复用端口 ${PROXY_PORT}`);
            return null;
        }

        // 启动proxy进程
        const proxyProcess = spawn(proxyPath, [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false,
            env: getProxyEnvironment()
        });

        log.info('正在启动proxy进程...');

        const startupError = new Promise<never>((_, reject) => {
            proxyProcess.once('error', error => reject(new Error(`Proxy进程启动失败: ${error.message}`)));
            proxyProcess.once('exit', (code, signal) => {
                reject(new Error(`Proxy进程在健康检查完成前退出 (code=${code}, signal=${signal})`));
            });

            proxyProcess.stdout?.on('data', (data) => {
                log.noformat(data.toString('utf8'));
            });
            proxyProcess.stderr?.on('data', (data) => {
                log.error('Proxy stderr:', data.toString('utf8'));
            });
        });
        sendProxySecret(proxyProcess, proxySecret);

        const healthy = await Promise.race([
            waitForProxyHealth(proxySecret, 10000),
            startupError,
        ]);
        if (!healthy) {
            proxyProcess.kill();
            throw new Error(
                `Proxy健康检查超时。请确认端口 ${PROXY_PORT} 未被其他程序占用，并检查安全软件是否拦截 ${proxyPath}`
            );
        }

        log.info('Proxy模块启动成功');

        // 初始化或更新守护程序
        if (!proxyDaemon) {
            proxyDaemon = getDaemonInstance({
                restartDelay: PROXY_RESTART_DELAY_MS,
                maxRestartAttempts: MAX_PROXY_RESTART_ATTEMPTS,
                restartAttemptResetTime: 60000,
                enableHeartbeat: true,
                heartbeatInterval: 5000,
            });
        }

        // 设置重启回调
        const handleProxyRestart = async (attempts: number) => {
            if (restartScheduled) return;
            restartScheduled = true;

            try {
                for (let attempt = attempts; attempt <= MAX_PROXY_RESTART_ATTEMPTS; attempt++) {
                    if (proxyDaemon?.isShutdownInProgress()) return;

                    await new Promise(resolve => setTimeout(resolve, PROXY_RESTART_DELAY_MS));
                    try {
                        log.info(`尝试重启Proxy进程 (第 ${attempt} 次)...`);
                        const newProxyProcess = await startProxyProcessInternal();
                        proxyDaemon?.updateProcess(newProxyProcess);
                        return;
                    } catch (error) {
                        const errorObj = error instanceof Error ? error : new Error(String(error));
                        log.error(`Proxy进程重启失败 (第 ${attempt} 次):`, errorObj.message);
                    }
                }

                try {
                    await dialog.showMessageBox({
                        type: 'error',
                        title: '应用即将退出',
                        message: '飞牛影视的核心服务（Proxy）多次启动失败，无法继续运行。',
                        buttons: ['退出应用'],
                    });
                } finally {
                    app.quit();
                }
            } finally {
                restartScheduled = false;
            }
        };

        // 启用守护程序监控
        proxyDaemon.watchProcess(proxyProcess, handleProxyRestart);

        return proxyProcess;

    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const errorMsg = `启动proxy模块失败`;
        const detailMsg = `错误详情: ${errorObj.message}\n\n这通常表示:\n• Proxy程序无法正常启动\n• 网络或端口配置问题\n• 系统环境配置错误\n\n请检查上述错误详情并尝试解决。\n如果问题持续，请查看应用程序日志获取更多信息。`;
        log.error(errorMsg + ': ' + errorObj.message);
        dialog.showErrorBox('启动失败', errorMsg + '\n\n' + detailMsg);
        throw error;
    }
}

/**
 * 内部启动函数（用于重启）
 */
async function startProxyProcessInternal(): Promise<ChildProcess> {
    const proxyPath = getProxyExecPath();
    const proxySecret = getProxySecret();

    // 启动proxy进程
    const proxyProcess = spawn(proxyPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        env: getProxyEnvironment()
    });

    log.info('正在启动proxy进程（重启）...');

    const startupError = new Promise<never>((_, reject) => {
        proxyProcess.once('error', reject);
        proxyProcess.once('exit', (code, signal) => {
            reject(new Error(`Proxy进程重启时提前退出 (code=${code}, signal=${signal})`));
        });

        proxyProcess.stdout?.on('data', (data) => {
            log.noformat(data.toString('utf8'));
        });
        proxyProcess.stderr?.on('data', (data) => {
            log.error('Proxy stderr:', data.toString('utf8'));
        });
    });
    sendProxySecret(proxyProcess, proxySecret);

    const healthy = await Promise.race([
        waitForProxyHealth(proxySecret, 10000),
        startupError,
    ]);
    if (!healthy) {
        proxyProcess.kill();
        throw new Error(`Proxy重启后健康检查超时，端口: ${PROXY_PORT}`);
    }

    return proxyProcess;
}

/**
 * 优雅关闭Proxy进程（用于应用退出）
 */
export async function shutdownProxyProcess(): Promise<void> {
    if (proxyDaemon) {
        await proxyDaemon.shutdown();
        proxyDaemon = null;
    }
}
