import { app, BrowserWindow, dialog, IpcMainEvent } from 'electron';
import * as ply from '../../../modules/players';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';
import * as os from 'os';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { PlayStatusData, ItemListRequest } from '../../../modules/fn_api/types';
import { isTrusted } from '../../../modules/cert_trust';
import { checkLibraryPageUrl } from '../../common/utils';
import { getMainWindow } from '../../common/mainwin';
import { getMpvConfigDir } from './mpvConfig';
import { resolveBundledMpvPath } from '../../common/mpvConfigHelpers';
import { getProxySecret } from '../../common/proxy';
import { createProxyPlaybackUrl, registerPlaybackSession } from '../../common/proxySession';
import type { ProxyPlaybackTarget } from '../../common/proxySession';
import { getAccessCookieHeader } from '../../../modules/fn_api/accessGrant';
import { getLibraryStore } from '../../../modules/library/libraryService';
import { buildLibraryPlaylist, findSidecarSubtitles } from '../../../modules/library/playback';
import type { LibraryPlayEntry } from '../../../modules/library/playback';
import type { LibraryStore } from '../../../modules/library/store';

/**
* 媒体播放插件
* 处理视频播放相关功能
*/
interface PlayRequest {
    id: string;
    sourceIndex: number; // 可选，播放源
}

// 库条目播放请求
interface LibraryPlayRequest {
    itemId: string;
}

// 全局播放器实例引用
let currentPlayer: ply.BasePlayer | null = null;
let playbackStarting = false;

// MPV播放器路径缓存
let cachedPlayerPath: string | null = null;

// 设置MPV播放器路径（用于覆盖默认路径）
export function setMpvPlayerPath(path: string | null): void {
    cachedPlayerPath = path;
}

/**
 * 获取MPV播放器路径（带缓存）
 * @returns 播放器路径或undefined
 */
function getMpvPlayerPath(): string | undefined {
    // 如果已经缓存了路径，直接返回
    if (cachedPlayerPath) {
        return cachedPlayerPath;
    }

    const platform = os.platform();

    if (platform === 'win32') {
        cachedPlayerPath = resolveBundledMpvPath({
            appPath: app.getAppPath(),
            execPath: process.execPath,
            isPackaged: app.isPackaged,
        });
        return cachedPlayerPath;
    } else if (platform === 'darwin') {
        // macOS 常用安装路径
        const macPaths = [
            '/opt/homebrew/bin/mpv',  // Apple Silicon Mac (M1/M2)
            '/usr/local/bin/mpv',     // Intel Mac 或手动安装
            '/Applications/mpv.app/Contents/MacOS/mpv', // App bundle
        ];

        for (const path of macPaths) {
            if (fs.existsSync(path)) {
                cachedPlayerPath = path;
                log.info(`找到MPV播放器路径: ${path}`);
                return cachedPlayerPath;
            }
        }

        // 未找到mpv播放器
        dialog.showErrorBox('错误', 'macOS平台未找到mpv播放器，请使用Homebrew安装mpv后重试: brew install mpv');
        log.error('macOS平台未找到mpv播放器，请使用Homebrew安装mpv后重试: brew install mpv');
        return undefined;
    } else if (platform === 'linux') {
        // Linux 常用安装路径
        const linuxPaths = [
            '/usr/bin/mpv',           // 系统包管理器安装
            '/usr/local/bin/mpv',     // 手动编译安装
            '/snap/bin/mpv',          // Snap 包
            '/usr/games/mpv',         // 某些发行版
            '/opt/mpv/bin/mpv',       // 可选安装位置
        ];

        for (const path of linuxPaths) {
            if (fs.existsSync(path)) {
                cachedPlayerPath = path;
                log.info(`找到MPV播放器路径: ${path}`);
                return cachedPlayerPath;
            }
        }

        // 未找到mpv播放器
        dialog.showErrorBox('错误', 'Linux平台未找到mpv播放器，请安装mpv播放器后重试');
        log.error('Linux平台未找到mpv播放器，请安装mpv播放器后重试');
        return undefined;
    }

    return undefined;
}

// 刷新窗口
async function refreshWindow(): Promise<void> {
    const currentURL = getMainWindow().webContents.getURL() || '';
    // 如果是资源库页面则不刷新
    if (checkLibraryPageUrl(currentURL)) {
        return;
    }

    log.info('刷新当前窗口');
    getMainWindow().webContents.reloadIgnoringCache();
}

/**
 * 创建播放器事件处理器
 * @param fnapi - API服务实例
 * @param itemGuid - 当前播放项的GUID
 * @returns 事件处理函数
 */
function eventHandler(fnapi: fn.ApiService) {
    return async (type: ply.EventType, data: ply.EventData) => {
        switch (type) {
            case ply.EventType.PROGRESS:
                const progressData = data as ply.PlayStatusData;

                if (progressData.itemGuid.length === 0) {
                    log.info("process itemguid is empty")
                    return;
                }

                // if (progressData.percentage > 90) {
                //     log.info('视频播放接近结束，更新状态...');
                //     await fnapi.setWatched(progressData.itemGuid);
                //     return;
                // }
                // 优先从缓存查询播放信息
                const resp = await fnapi.getPlayInfoCached(progressData.itemGuid);
                if (!resp.success || !resp.data) {
                    log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
                    return;
                }

                const info = resp.data;

                const record: fn.PlayStatusData = {
                    item_guid: progressData.itemGuid,
                    media_guid: info.media_guid,
                    video_guid: info.video_guid,
                    audio_guid: info.audio_guid,
                    subtitle_guid: info.subtitle_guid,
                    play_link: new URL(fnapi.getVideoUrl(info.media_guid)).hostname,
                    ts: progressData.ts,
                    duration: progressData.duration,
                };

                log.info('播放进度更新:', record);

                await fnapi.recordPlayStatus(record);
                break;

            case ply.EventType.ERROR:
                const errorData = data as ply.PlayErrorData;
                log.error('MPV error:', String(errorData.message));
                break;

            case ply.EventType.EXIT:
                const event = data as ply.PlayExitData;
                if (event.code !== 0) {
                    log.error(`播放器异常退出 (code ${event.code})`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await refreshWindow();
                    return;
                }

                if (event.status.itemGuid.length === 0) {
                    return;
                }

                log.info('MPV exited with code:', event.code);
                log.info('最后播放位置:', event.status);

                // if (event.status.percentage > 90) {
                //     log.info('视频播放接近结束，更新状态...');
                //     await fnapi.setWatched(event.status.itemGuid);
                // } else {
                // 优先从缓存查询播放信息
                {
                    const resp = await fnapi.getPlayInfoCached(event.status.itemGuid);
                    if (!resp.success || !resp.data) {
                        log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
                        return;
                    }

                    const info = resp.data;

                    const record: fn.PlayStatusData = {
                        item_guid: event.status.itemGuid,
                        media_guid: info.media_guid,
                        video_guid: info.video_guid,
                        audio_guid: info.audio_guid,
                        subtitle_guid: info.subtitle_guid,
                        play_link: new URL(fnapi.getVideoUrl(info.media_guid)).hostname,
                        ts: event.status.ts,
                        duration: event.status.duration,
                    };

                    log.debug('记录播放状态start');
                    await fnapi.recordPlayStatus(record);
                    log.debug('记录播放状态end');
                }

                // 正常退出只回传最终进度；整页刷新会造成主窗口白闪。
                break;

            default:
                log.debug('收到播放器事件:', type);
                break;
        }
    };
}

// 处理播放事件
async function handlePlayMovie(_event: IpcMainEvent, request: PlayRequest): Promise<void> {
    if (playbackStarting || currentPlayer?.isPlaying()) {
        log.warn('播放器正在启动或播放，忽略重复播放请求');
        return;
    }

    playbackStarting = true;
    try {
        await startPlayback(request);
    } finally {
        playbackStarting = false;
    }
}

async function startPlayback({ id, sourceIndex }: PlayRequest): Promise<void> {
    log.info('Play movie event received id:', id, ' index:', sourceIndex);

    const config = fnConfig.readConfig();
    if (!config?.domain || !config.token || !config.account) {
        throw new Error('无法找到有效的服务器登录配置');
    }

    // 播放凭据只取自主进程安全配置，不信任远程页面传入的 token。
    const fnapi = new fn.ApiService(config.domain, config.token);

    const response = await fnapi.getPlayInfo(id);
    if (!response.success || !response.data) {
        log.error('获取播放信息失败:', response ? response.message : '未知错误');
        return;
    }

    log.info('获取播放信息成功:', {
        guid: response.data.guid,
        type: response.data.type,
        parent_guid: response.data.parent_guid || '',
    });

    const type = response.data.type;
    const parentGuid = response.data.parent_guid;
    const itemGuid = response.data.guid;

    let playList: ply.PlayItem[] = [];
    if (type === 'Episode' && parentGuid) {
        log.info('当前为剧集，尝试获取系列下的所有剧集进行播放');
        const episodeList = await fnapi.getEpisodeList(parentGuid);
        if (!episodeList.success || !episodeList.data) {
            log.error('获取剧集列表失败:', episodeList ? episodeList.message : '未知错误');
            return;
        }

        for (const episode of episodeList.data) {
            const mediaItem = processEpisodeMedia(episode);
            playList.push(mediaItem);
            log.info('添加剧集到播放列表:', mediaItem.itemGuid);
        }
    } 
    else if (type === 'Video' && parentGuid) {
        log.info('当前为其他视频，添加到播放列表');
        const req: ItemListRequest = {
            parent_guid: parentGuid,
            exclude_folder: 1,
            sort_column: 'sort_title',
            sort_type: 'ASC',
        };

        const mediaList = await fnapi.getItemList(req);
        if (!mediaList.success || !mediaList.data || !mediaList.data.list) {
            log.error('获取媒体列表失败:', mediaList ? mediaList.message : '未知错误');
            return;
        }
        log.info(`获取媒体列表成功，共 ${mediaList.data.list.length} 项`);

        for (const media of mediaList.data.list) {
            const mediaItem = processEpisodeMedia(media);
            playList.push(mediaItem);
            log.info('添加媒体到播放列表:', mediaItem.itemGuid);
        }
    }
    else {
        const mediaItem = processSingleMedia(response.data);
        playList.push(mediaItem);
        log.info('添加单集到播放列表:', mediaItem.itemGuid);
    }

    if (playList.length === 0) {
        log.warn('播放列表为空');
        return;
    }

    // 寻找当前播放的媒体在数组中的位置
    const currentIndex = playList.findIndex(item => item.itemGuid === itemGuid);
    if (currentIndex < 0) {
        throw new Error('当前播放项不在生成的播放列表中');
    }

    const session = await registerPlaybackSession(getProxySecret(), {
        token: config.token,
        account: config.account,
        domain: config.domain,
        accessCookie: getAccessCookieHeader(config.domain),
        skipVerify: isTrusted(config.domain),
        useNasLocal: config.nasProxyEnabled === true,
        itemGuids: playList.map(item => item.itemGuid),
    });
    playList = playList.map(item => ({
        ...item,
        playLink: createProxyPlaybackUrl(session, item.itemGuid),
    }));

    // 检查是否选择了特定的播放源索引
    const selectedSourceIndex = Number.isInteger(sourceIndex) && sourceIndex > 0 ? sourceIndex : 0;
    if (selectedSourceIndex > 0) {
        log.info(`使用指定的播放源索引: ${selectedSourceIndex}`);
        // 修改播放列表中的源索引
        playList[currentIndex].playLink = createProxyPlaybackUrl(
            session,
            playList[currentIndex].itemGuid,
            selectedSourceIndex,
        );
    }

    // 获取MPV播放器路径
    const playerPath = getMpvPlayerPath();
    if (!playerPath) {
        log.error('无法找到MPV播放器路径');
        return;
    }

    const mpvArgs = buildMpvArgs();

    let playConfig: ply.Config = {
        fnapi: fnapi,
        playerPath: playerPath,
        // headers: {
        //     Authorization: token,
        // },
        extraArgs: mpvArgs,
        debug: true,
        onEvent: eventHandler(fnapi),
        onVolumeChange: fnConfig.setMpvVolume,
    };

    // 创建播放器实例
    const player = ply.PlayerFactory.createPlayer(ply.PlayerType.MPV, playConfig);

    // 保存全局引用
    currentPlayer = player;

    // 开始播放
    const started = await player.playList(playList, currentIndex);
    if (!started && currentPlayer === player) {
        currentPlayer = null;
        return;
    }
}

// 构建MPV启动参数（fnOS 与本地播放共用）
function buildMpvArgs(): string[] {
    const mpvArgs = [
        '--force-window=immediate',
        '--border=no',
        '--network-timeout=180',
        `--volume=${fnConfig.getMpvVolume()}`,
    ];
    if (os.platform() === 'win32' && !fnConfig.getMpvPlayerPath()) {
        // bundled mpv.exe 自带 portable_config；显式指向用户目录，避免状态写入安装目录。
        mpvArgs.push(`--config-dir=${getMpvConfigDir()}`);
    }
    return mpvArgs;
}

// 库条目 → MPV 播放项转换
function libraryEntryToPlayItem(entry: LibraryPlayEntry, playLink: string): ply.PlayItem {
    return {
        itemGuid: entry.itemGuid,
        title: entry.title,
        tvTitle: entry.tvTitle,
        seasonNumber: entry.seasonNumber,
        episodeNumber: entry.episodeNumber,
        ts: entry.ts,
        duration: entry.duration,
        playLink,
    };
}

// 直连播放地址（代理不可用时的回退：本地文件转 file:// URL，strm 直出）
function directPlayLink(entry: LibraryPlayEntry): string {
    return entry.source.kind === 'file'
        ? pathToFileURL(entry.source.path).href
        : entry.source.url;
}

// 库播放事件处理器：进度写入本地库，无服务器回传
function libraryEventHandler(store: LibraryStore) {
    return async (type: ply.EventType, data: ply.EventData): Promise<void> => {
        switch (type) {
            case ply.EventType.PROGRESS: {
                const progressData = data as ply.PlayStatusData;
                if (progressData.itemGuid.length === 0) {
                    return;
                }
                try {
                    store.recordProgress(progressData.itemGuid, progressData.ts, progressData.duration);
                    log.debug('本地播放进度更新:', progressData.itemGuid, progressData.ts, '/', progressData.duration);
                } catch (error) {
                    log.error('本地播放进度写入失败:', error);
                }
                break;
            }
            case ply.EventType.ERROR:
                log.error('MPV error:', String((data as ply.PlayErrorData).message));
                break;
            case ply.EventType.EXIT: {
                const event = data as ply.PlayExitData;
                if (event.code !== 0) {
                    log.error(`播放器异常退出 (code ${event.code})`);
                    return;
                }
                if (event.status.itemGuid.length > 0) {
                    try {
                        store.recordProgress(event.status.itemGuid, event.status.ts, event.status.duration);
                        log.info('本地播放结束，最终进度:', event.status.ts, '/', event.status.duration);
                    } catch (error) {
                        log.error('本地播放最终进度写入失败:', error);
                    }
                }
                break;
            }
            default:
                log.debug('收到播放器事件:', type);
                break;
        }
    };
}

// 库条目播放入口
async function handlePlayLibraryItem(_event: IpcMainEvent, request: LibraryPlayRequest): Promise<void> {
    if (playbackStarting || currentPlayer?.isPlaying()) {
        log.warn('播放器正在启动或播放，忽略重复播放请求');
        return;
    }

    playbackStarting = true;
    try {
        await startLibraryPlayback(request);
    } finally {
        playbackStarting = false;
    }
}

async function startLibraryPlayback({ itemId }: LibraryPlayRequest): Promise<void> {
    log.info('Library play event received itemId:', itemId);
    const store = getLibraryStore();

    const playlistResult = buildLibraryPlaylist(store, itemId);
    if (!playlistResult) {
        log.error('媒体库条目不存在:', itemId);
        return;
    }

    // 过滤掉源不存在的条目（文件被删除或 strm 内容为空）
    const validEntries = playlistResult.entries.filter((entry) =>
        entry.source.kind === 'file' ? fs.existsSync(entry.source.path) : entry.source.url.length > 0
    );
    if (validEntries.length === 0) {
        log.error('播放列表条目均不可用:', itemId);
        return;
    }

    const clickedGuid = playlistResult.entries[playlistResult.currentIndex]?.itemGuid ?? itemId;
    let currentIndex = validEntries.findIndex((entry) => entry.itemGuid === clickedGuid);
    if (currentIndex < 0) {
        currentIndex = 0;
    }
    const currentEntry = validEntries[currentIndex];

    // 通过本地代理注册直接播放目标：mpv 的跳过片头片尾插件（smart_skip）
    // 依赖播放 URL 中的会话参数访问代理接口；代理不可用时回退为直连播放。
    let playList: ply.PlayItem[] = [];
    try {
        const targets: Record<string, ProxyPlaybackTarget> = {};
        for (const entry of validEntries) {
            targets[entry.itemGuid] = entry.source.kind === 'file'
                ? { kind: 'file', path: entry.source.path, skipKey: entry.skipKey }
                : { kind: 'url', url: entry.source.url, skipKey: entry.skipKey };
        }
        const session = await registerPlaybackSession(getProxySecret(), {
            targets,
            itemGuids: validEntries.map((entry) => entry.itemGuid),
        });
        playList = validEntries.map((entry) =>
            libraryEntryToPlayItem(entry, createProxyPlaybackUrl(session, entry.itemGuid))
        );
    } catch (error) {
        log.warn('[library] 代理会话创建失败，回退为直连播放（跳过片头片尾不可用）:', error);
        playList = validEntries.map((entry) => libraryEntryToPlayItem(entry, directPlayLink(entry)));
    }

    const playerPath = getMpvPlayerPath();
    if (!playerPath) {
        log.error('无法找到MPV播放器路径');
        return;
    }

    const mpvArgs = buildMpvArgs();
    if (currentEntry.source.kind === 'file') {
        // 本地视频自动挂载同目录 sidecar 字幕
        const subtitles = await findSidecarSubtitles(currentEntry.source.path);
        for (const subPath of subtitles) {
            mpvArgs.push(`--sub-file=${subPath}`);
        }
        if (subtitles.length > 0) {
            log.info(`挂载本地字幕 ${subtitles.length} 个`);
        }
    }

    store.markPlaybackStart(clickedGuid);

    const playConfig: ply.Config = {
        fnapi: null,
        playerPath,
        extraArgs: mpvArgs,
        debug: true,
        onEvent: libraryEventHandler(store),
        onVolumeChange: fnConfig.setMpvVolume,
    };

    const player = ply.PlayerFactory.createPlayer(ply.PlayerType.MPV, playConfig);
    currentPlayer = player;

    const started = await player.playList(playList, currentIndex);
    if (!started && currentPlayer === player) {
        currentPlayer = null;
    }
}

// 处理当前播放的媒体信息
function processEpisodeMedia(info: fn.PlayListItem): ply.PlayItem {    return {
        itemGuid: info.guid,
        title: info.title,
        tvTitle: info.tv_title,
        seasonNumber: info.season_number,
        episodeNumber: info.episode_number,
        ts: info.ts,
        duration: info.duration,
        playLink: '',
    };
}

// 处理单个待播放媒体信息
function processSingleMedia(info: fn.PlayInfo): ply.PlayItem {
    return {
        itemGuid: info.guid,
        title: info.item.title,
        tvTitle: info.item.tv_title,
        seasonNumber: info.item.season_number,
        episodeNumber: info.item.episode_number,
        ts: info.ts,
        duration: info.item.duration,
        playLink: '',
    };
}

// 应用退出前清理播放器
function handleBeforeQuit(): void {
    if (currentPlayer) {
        log.info('应用退出前关闭播放器');
        currentPlayer.stop();
        currentPlayer = null;
    }

    // 清理播放器路径缓存
    cachedPlayerPath = null;
}

// 注册媒体播放处理器
function init(): void {
    // 从配置中读取MPV播放器路径并设置
    const configMpvPath = fnConfig.getMpvPlayerPath();
    if (configMpvPath) {
        setMpvPlayerPath(configMpvPath);
        log.info(`从配置中加载MPV播放器路径: ${configMpvPath}`);
    }

    registerHandler('play-movie', handlePlayMovie);
    registerHandler('play-library-item', handlePlayLibraryItem);
    registerAppHook('beforeQuit', handleBeforeQuit);
}

export {
    init
};
