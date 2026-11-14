

// 检查当前页面是否为资源库页面（本地媒体库页或飞牛网页版资源库）
export function checkLibraryPageUrl(url: string) {
    if (!url) return false;
    if (url.includes('/v/library/') || url.includes('/v/favorite') || url.includes('/v/list/') || url.includes('/v/folder/')) {
        return true;
    }
    // 本地媒体库页面：file:///.../resource/library/index.html
    return url.startsWith('file:') && url.includes('/resource/library/');
}