/** 本地文件路径 → file:// URL（与 classic UI 一致；Windows/UNC 兼容） */
export function toFileUrl(filePath: string | null | undefined): string {
    if (!filePath) {
        return '';
    }
    if (/^(file|https?):\/\//i.test(filePath)) {
        return filePath;
    }
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.startsWith('//')) {
        return 'file:' + normalized;
    }
    return 'file:///' + normalized.replace(/^\/+/, '');
}
