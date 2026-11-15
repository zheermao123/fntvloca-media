import { invoke, onceReply, sendChannel } from '../desktop/desktopBridge';

export type ScraperSettings = {
    apiKey: string;
    apiBaseUrl: string;
    imageBaseUrl: string;
    language: string;
};

export async function fetchScraperSettings(): Promise<ScraperSettings> {
    const result = await invoke<{ settings?: ScraperSettings }>('library:settings-get', undefined, 'library:settings-info');
    return {
        apiKey: result?.settings?.apiKey ?? '',
        apiBaseUrl: result?.settings?.apiBaseUrl ?? '',
        imageBaseUrl: result?.settings?.imageBaseUrl ?? '',
        language: result?.settings?.language ?? '',
    };
}

export async function saveScraperSettings(settings: Partial<ScraperSettings>): Promise<void> {
    const reply = onceReply<{ success?: boolean; error?: string }>('library:settings-set', 15000);
    if (!sendChannel('library:settings-set', settings)) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result?.success) {
        throw new Error(result?.error || '保存 TMDB 设置失败');
    }
}

export type DownloadProxySettings = {
    enabled: boolean;
    proxyUrl: string;
};

export async function fetchDownloadProxy(): Promise<DownloadProxySettings> {
    const result = await invoke<Partial<DownloadProxySettings>>('get-download-proxy', undefined, 'download-proxy-info');
    return { enabled: result?.enabled !== false, proxyUrl: result?.proxyUrl ?? '' };
}

export async function saveDownloadProxy(settings: DownloadProxySettings): Promise<void> {
    const reply = onceReply<{ success?: boolean; error?: string }>('download-proxy-set', 15000);
    if (!sendChannel('set-download-proxy', settings)) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result?.success) {
        throw new Error(result?.error || '保存代理设置失败');
    }
}

export async function fetchMpvPlaybackEnabled(): Promise<boolean> {
    const result = await invoke<{ hideOriginalPlayButton?: boolean }>(
        'get-play-button-config',
        undefined,
        'play-button-config-info'
    );
    return result?.hideOriginalPlayButton !== false;
}

export async function saveMpvPlaybackEnabled(enabled: boolean): Promise<void> {
    const reply = onceReply<{ success?: boolean; error?: string }>('play-button-config-set', 15000);
    if (!sendChannel('set-play-button-config', { hideOriginalPlayButton: enabled })) {
        throw new Error('BRIDGE_UNAVAILABLE');
    }
    const result = await reply;
    if (!result?.success) {
        throw new Error(result?.error || '保存播放设置失败');
    }
}

export async function fetchAppVersion(): Promise<string> {
    const result = await invoke<{ version?: string }>('get-version', undefined, 'version-info');
    return result?.version ?? '';
}

export function checkForUpdates(): boolean {
    return sendChannel('check-update');
}
