import fs from 'fs';
import path from 'path';

export const VIDEO_EXTENSIONS: readonly string[] = [
    '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.ts', '.m2ts', '.mts',
    '.webm', '.rmvb', '.rm', '.mpg', '.mpeg', '.m4v', '.vob', '.iso', '.strm',
];

const JUNK_DIRS = new Set([
    '$recycle.bin',
    'system volume information',
    'lost+found',
    '@eadir',
    'recycled',
    'recycler',
    'dmzj_cache',
    '.trash',
    'trojans',
]);

export type ScannedFile = {
    path: string;
    size: number;
    mtime: number;
    isSample: boolean;
};

export type ScanError = {
    path: string;
    message: string;
};

export type ScanResult = {
    files: ScannedFile[];
    errors: ScanError[];
    truncated: boolean;
};

export type ScanOptions = {
    rootPath: string;
    excludePatterns?: string[];
    maxDepth?: number;
    maxFiles?: number;
    onProgress?: (scanned: number) => void;
};

const SAMPLE_PATTERN = /\bsample\b/i;

export function isVideoFile(name: string): boolean {
    const dot = name.lastIndexOf('.');
    if (dot < 0) {
        return false;
    }
    const ext = name.slice(dot).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

const SNIFF_BUFFER_SIZE = 192;

// 文件头魔数匹配：识别扩展名被改错的视频文件（真实文档类签名如 OLE2 不会命中）
function matchesVideoMagic(buffer: Buffer): boolean {
    // Matroska / WebM
    if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
        return true;
    }
    // MP4 / MOV / M4V 家族：偏移 4 处 'ftyp'
    if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
        return true;
    }
    // AVI：'RIFF' + 'AVI '
    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x41 && buffer[9] === 0x56 && buffer[10] === 0x49 && buffer[11] === 0x20
    ) {
        return true;
    }
    // MPEG-TS：偏移 0 与 188 均为 0x47 同步字节
    if (buffer.length >= 189 && buffer[0] === 0x47 && buffer[188] === 0x47) {
        return true;
    }
    // FLV
    if (buffer.length >= 4 && buffer[0] === 0x46 && buffer[1] === 0x4c && buffer[2] === 0x56 && buffer[3] === 0x01) {
        return true;
    }
    // ASF / WMV
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x30 && buffer[1] === 0x26 && buffer[2] === 0xb2 && buffer[3] === 0x75 &&
        buffer[4] === 0x8e && buffer[5] === 0x66 && buffer[6] === 0xcf && buffer[7] === 0x11
    ) {
        return true;
    }
    // OGG
    if (buffer.length >= 4 && buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
        return true;
    }
    // RealMedia
    if (buffer.length >= 4 && buffer[0] === 0x2e && buffer[1] === 0x52 && buffer[2] === 0x4d && buffer[3] === 0x46) {
        return true;
    }
    return false;
}

/**
 * 读取文件头判断是否为视频容器（用于扩展名不在白名单时的兜底识别）。
 * 读取失败（权限/占用）返回 false，不产生扫描错误。
 */
export async function sniffVideoFile(filePath: string): Promise<boolean> {
    let handle: fs.promises.FileHandle | null = null;
    try {
        handle = await fs.promises.open(filePath, 'r');
        const buffer = Buffer.alloc(SNIFF_BUFFER_SIZE);
        const { bytesRead } = await handle.read(buffer, 0, SNIFF_BUFFER_SIZE, 0);
        if (bytesRead < 4) {
            return false;
        }
        return matchesVideoMagic(buffer.subarray(0, bytesRead));
    } catch {
        return false;
    } finally {
        if (handle) {
            await handle.close().catch(() => undefined);
        }
    }
}

function isExcluded(relativeDir: string, excludePatterns: string[]): boolean {
    for (const pattern of excludePatterns) {
        if (pattern.length === 0) {
            continue;
        }
        try {
            if (new RegExp(pattern, 'i').test(relativeDir)) {
                return true;
            }
        } catch {
            if (relativeDir.toLowerCase().includes(pattern.toLowerCase())) {
                return true;
            }
        }
    }
    return false;
}

function shouldSkipDir(name: string): boolean {
    if (name.startsWith('.')) {
        return true;
    }
    return JUNK_DIRS.has(name.toLowerCase());
}

export async function scanLocalFolder(options: ScanOptions): Promise<ScanResult> {
    const rootPath = options.rootPath;
    const maxDepth = options.maxDepth ?? 12;
    const maxFiles = options.maxFiles ?? 200000;
    const excludePatterns = options.excludePatterns ?? [];
    const files: ScannedFile[] = [];
    const errors: ScanError[] = [];
    let truncated = false;

    let rootStat: fs.Stats | null = null;
    try {
        rootStat = await fs.promises.stat(rootPath);
    } catch (error) {
        return {
            files: [],
            errors: [
                {
                    path: rootPath,
                    message: error instanceof Error ? error.message : String(error),
                },
            ],
            truncated: false,
        };
    }
    if (!rootStat.isDirectory()) {
        return {
            files: [],
            errors: [{ path: rootPath, message: 'Not a directory' }],
            truncated: false,
        };
    }

    const queue: Array<{ dir: string; relative: string; depth: number }> = [
        { dir: rootPath, relative: '', depth: 0 },
    ];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            break;
        }
        if (current.depth > maxDepth) {
            continue;
        }
        if (current.relative.length > 0 && isExcluded(current.relative, excludePatterns)) {
            continue;
        }

        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(current.dir, { withFileTypes: true });
        } catch (error) {
            errors.push({
                path: current.dir,
                message: error instanceof Error ? error.message : String(error),
            });
            continue;
        }

        for (const entry of entries) {
            const entryPath = path.join(current.dir, entry.name);
            const relativePath = current.relative.length > 0 ? `${current.relative}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                if (!shouldSkipDir(entry.name)) {
                    queue.push({ dir: entryPath, relative: relativePath, depth: current.depth + 1 });
                }
                continue;
            }
            if (!entry.isFile()) {
                continue;
            }
            if (!isVideoFile(entry.name) && !(await sniffVideoFile(entryPath))) {
                continue;
            }
            if (files.length >= maxFiles) {
                truncated = true;
                queue.length = 0;
                break;
            }

            try {
                const stat = await fs.promises.stat(entryPath);
                files.push({
                    path: entryPath,
                    size: stat.size,
                    mtime: Math.floor(stat.mtimeMs),
                    isSample: SAMPLE_PATTERN.test(entry.name),
                });
                if (options.onProgress && files.length % 200 === 0) {
                    options.onProgress(files.length);
                }
            } catch (error) {
                errors.push({
                    path: entryPath,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }
        if (truncated) {
            break;
        }
    }

    return { files, errors, truncated };
}
