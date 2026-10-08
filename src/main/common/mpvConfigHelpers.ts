import * as fs from 'node:fs';
import * as path from 'path';

interface PortableConfigPaths {
    appPath: string;
    isPackaged: boolean;
    resourcesPath: string;
}

interface BundledMpvPaths {
    appPath: string;
    execPath: string;
    isPackaged: boolean;
}

export function resolvePortableConfigDir(paths: PortableConfigPaths): string {
    const baseDir = paths.isPackaged
        ? path.dirname(paths.resourcesPath)
        : paths.appPath;
    return path.join(baseDir, 'third_party', 'fntv-mpv', 'portable_config');
}

export function resolveBundledMpvPath(paths: BundledMpvPaths): string {
    const baseDir = paths.isPackaged
        ? path.dirname(paths.execPath)
        : paths.appPath;
    return path.join(baseDir, 'third_party', 'fntv-mpv', 'mpv.exe');
}

export type MpvConfigSyncResult = 'initialized' | 'updated';

/**
 * 将应用内置的插件补丁覆盖层（resource/mpv-overlay）覆盖到 portable_config。
 * CI 构建时 third_party 由外部 mpv-config.zip 解压而来（仓库不含），此步骤保证
 * 我们对 uosc_danmaku 的修复随应用发布，且在上游 zip 更新后依然生效。
 * 返回覆盖的文件数。
 */
export function applyMpvConfigOverlay(
    portableConfigDir: string,
    overlayDir: string,
): number {
    if (!fs.existsSync(overlayDir)) {
        return 0;
    }
    let applied = 0;
    const walk = (source: string, destination: string): void => {
        fs.mkdirSync(destination, { recursive: true });
        for (const item of fs.readdirSync(source, { withFileTypes: true })) {
            const sourcePath = path.join(source, item.name);
            const destinationPath = path.join(destination, item.name);
            if (item.isDirectory()) {
                walk(sourcePath, destinationPath);
            } else {
                fs.copyFileSync(sourcePath, destinationPath);
                applied += 1;
            }
        }
    };
    walk(overlayDir, portableConfigDir);
    return applied;
}

function copyDirectoryRecursive(
    source: string,
    destination: string,
    overwrite: boolean = true,
): void {
    fs.mkdirSync(destination, { recursive: true });

    for (const item of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, item.name);
        const destinationPath = path.join(destination, item.name);
        if (item.isDirectory()) {
            copyDirectoryRecursive(sourcePath, destinationPath, overwrite);
        } else if (overwrite || !fs.existsSync(destinationPath)) {
            fs.copyFileSync(sourcePath, destinationPath);
        }
    }
}

export function synchronizeMpvConfig(
    portableConfigDir: string,
    mpvConfigDir: string,
): MpvConfigSyncResult {
    if (!fs.existsSync(portableConfigDir)) {
        throw new Error(`Portable config directory not found: ${portableConfigDir}`);
    }

    const scriptsDir = path.join(mpvConfigDir, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        // Existing user files may predate managed scripts; seed missing bundle files only.
        copyDirectoryRecursive(portableConfigDir, mpvConfigDir, false);
        return 'initialized';
    }

    const managedPlugin = 'uosc_danmaku';
    const sourcePluginDir = path.join(portableConfigDir, 'scripts', managedPlugin);
    if (!fs.existsSync(sourcePluginDir) || !fs.statSync(sourcePluginDir).isDirectory()) {
        throw new Error(`Managed MPV plugin not found: ${sourcePluginDir}`);
    }

    const destinationPluginDir = path.join(scriptsDir, managedPlugin);
    fs.rmSync(destinationPluginDir, { recursive: true, force: true });
    copyDirectoryRecursive(sourcePluginDir, destinationPluginDir);
    return 'updated';
}
