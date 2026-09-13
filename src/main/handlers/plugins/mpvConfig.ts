import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as logger from '../../../modules/logger';
import {
    resolvePortableConfigDir,
    synchronizeMpvConfig,
} from '../../common/mpvConfigHelpers';

/**
 * MPV配置文件管理插件
 * 初始化用户 MPV 配置，并同步由应用托管的插件代码。
 */

// 获取用户MPV配置目录
export function getMpvConfigDir(): string {
    const homeDir = os.homedir();
    if (process.platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Roaming', 'mpv');
    } else {
        return path.join(homeDir, '.config', 'mpv');
    }
}

// 获取应用中的portable_config目录
function getPortableConfigDir(): string {
    return resolvePortableConfigDir({
        appPath: app.getAppPath(),
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
    });
}

// 检查并复制配置文件
function initializeMpvConfig(): void {
    try {
        const mpvConfigDir = getMpvConfigDir();
        const portableConfigDir = getPortableConfigDir();
        const result = synchronizeMpvConfig(portableConfigDir, mpvConfigDir);
        if (result === 'initialized') {
            logger.info(`MPV配置初始化完成: ${mpvConfigDir}`);
        } else {
            logger.info('MPV托管插件已同步: uosc_danmaku');
        }

    } catch (error) {
        logger.error('初始化MPV配置失败:', error);
    }
}

// 插件初始化函数
function init(): void {
    logger.info('Initializing MPV Config Plugin...');
    initializeMpvConfig();
}

export {
    init
};
