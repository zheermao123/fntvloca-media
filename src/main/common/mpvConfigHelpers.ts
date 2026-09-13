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
