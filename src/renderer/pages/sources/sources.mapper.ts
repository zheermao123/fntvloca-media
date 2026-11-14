/** 媒体源列表 DTO 与展示映射（敏感信息脱敏、隐私隐藏为纯函数） */
export type SourceDto = {
    id: string;
    type: 'local' | 'webdav' | 'strm' | 'fnos' | string;
    name: string;
    config: Record<string, string>;
    createdAt: number;
    lastScanAt: number | null;
    itemCount: number;
    category?: string;
};

export type SourceRowModel = {
    id: string;
    name: string;
    typeLabel: string;
    location: string;
    itemCount: number;
    lastScanLabel: string;
};

export type ScanDoneDto = {
    error?: string;
    added?: number;
    updated?: number;
    removed?: number;
    skipped?: number;
    removedSources?: string[];
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
    local: '本地文件夹',
    webdav: 'WebDAV',
    strm: 'STRM',
    fnos: '飞牛 NAS',
};

export function stripUrlCredentials(raw: string): string {
    try {
        const url = new URL(raw);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return raw.replace(/\/\/[^/@]+@/, '//');
    }
}

export function sourceLocation(source: SourceDto, privacyActive: boolean): string {
    if (privacyActive) {
        return '已隐藏（隐私模式）';
    }
    const config = source.config ?? {};
    if (typeof config.rootPath === 'string' && config.rootPath.length > 0) {
        return config.rootPath;
    }
    if (typeof config.path === 'string' && config.path.length > 0) {
        return config.path;
    }
    if (typeof config.url === 'string' && config.url.length > 0) {
        return stripUrlCredentials(config.url);
    }
    return '—';
}

export function formatLastScan(lastScanAt: number | null): string {
    if (!lastScanAt) {
        return '从未扫描';
    }
    const date = new Date(lastScanAt);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toSourceRows(sources: readonly SourceDto[], privacyActive: boolean): SourceRowModel[] {
    return sources.map((source) => ({
        id: source.id,
        name: source.name,
        typeLabel: SOURCE_TYPE_LABELS[source.type] ?? source.type,
        location: sourceLocation(source, privacyActive),
        itemCount: source.itemCount,
        lastScanLabel: formatLastScan(source.lastScanAt),
    }));
}

export function formatScanResult(result: ScanDoneDto): string {
    if (result.error) {
        return `扫描失败：${result.error}`;
    }
    const parts = [
        `新增 ${result.added ?? 0}`,
        `更新 ${result.updated ?? 0}`,
        `移除 ${result.removed ?? 0}`,
        `跳过 ${result.skipped ?? 0}`,
    ];
    const cleaned = result.removedSources && result.removedSources.length > 0
        ? `，已清理失效源：${result.removedSources.join('、')}`
        : '';
    return `扫描完成：${parts.join('，')}${cleaned}`;
}
