// preload/core/utils.ts

// 检查当前页面是否最后一层(电影或剧集页面或者其他页面)
function checkFinalPageUrl() {
    const url = window.location.href;
    return url.includes('/v/movie/') || url.includes('/v/tv/episode/') || url.includes('/v/other/');
}

// 检查当前页面是否为季页面
function checkSeasonPageUrl() {
    const url = window.location.href;
    return url.includes('/v/tv/season/');
}

// 检查当前页面是否为剧集页面
function checkTVPageUrl() {
    const url = window.location.href;
    return url.includes('/v/tv/');
}

export { checkFinalPageUrl, checkSeasonPageUrl, checkTVPageUrl };
