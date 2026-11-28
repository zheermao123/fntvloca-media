/** React UI 2.0 页面识别（preload 侧；用于避免 classic 播放按钮接管插件劫持 React 控件） */
export function isUi2ReactDocument(location: {
    protocol: string;
    hostname: string;
    port: string;
    pathname: string;
}): boolean {
    if (location.protocol === 'file:') {
        return /\/ui2-renderer\//i.test(location.pathname);
    }
    const hostname = location.hostname.toLowerCase();
    return (
        location.protocol === 'http:' &&
        (hostname === '127.0.0.1' || hostname === 'localhost') &&
        location.port === '5273'
    );
}
