# fntvloca-media 本地媒体库

> 基于 [QiaoKes/fntv-electron](https://github.com/QiaoKes/fntv-electron)（GPL-3.0）改造的多源本地媒体管理器桌面客户端。

以本地媒体库为核心：扫描本机磁盘 / SMB 目录，自动识别电影与剧集，TMDB 在线刮削海报与简介，使用内置 MPV 播放（弹幕 / 字幕 / Anime4K / 断点续播）。

## ✨ 主要功能

- **多源媒体库** — 本机磁盘 / SMB、（规划中）WebDAV 与 fnOS NAS
- **智能识别** — 中英文命名、季集号、多版本、乱扩展名兜底识别（文件头嗅探）
- **在线刮削** — TMDB 自动拉取海报、简介、评分、集名；API / 图片域名可配置镜像
- **专业播放** — MPV 播放引擎：断点续播、多集连播、音量记忆
- **播放增强** — 弹幕自动匹配（uosc_danmaku）、Anime4K 着色器、跳过片头片尾（章节 / 手动 / 快捷键）
- **字幕支持** — 自动挂载同目录 srt / ass / ssa / sup / vtt 字幕
- **观看管理** — 已看标记、继续观看、观看历史（全部本地存储）
- **STRM 直链** — `.strm` 文件内的直链 URL 可直接播放
- **本地数据** — SQLite 存储（`~/.fntv/library/`），不可用时自动降级 JSON

## 📦 安装

### 预编译版本

前往 [Releases 页面](https://github.com/zheermao123/fntvloca-media/releases) 下载最新版本：

- 文件名格式：`FNMedia_${version}_${os}_${arch}.${ext}`
- Windows 直接安装即可
- macOS 安装后执行：

```bash
sudo find "/Applications/飞牛影视.app" -exec xattr -d com.apple.quarantine {} \; 2>/dev/null
```

- Linux 需先安装 mpv（> 0.37.0）；弹幕 / 着色器配置请从 [fntv-mpv-config](https://github.com/QiaoKes/fntv-mpv-config/releases) 获取

### 从源码构建

```bash
git clone https://github.com/zheermao123/fntvloca-media.git
cd fntvloca-media
npm i
npm start        # 开发运行（需要 Go 工具链编译本地代理）
npm run build:win    # 构建 Windows 安装包
npm run build:mac    # 构建 macOS 安装包
npm run build:linux  # 构建 Linux 安装包
```

## 🚀 快速上手

1. 启动应用，进入媒体库页面
2. 「源管理」→ 选择文件夹 → 添加并扫描
3. 「设置」填写 TMDB API Key（在 [themoviedb.org](https://www.themoviedb.org) 免费申请；国内网络可配置镜像地址）
4. 点击「刮削」获取海报与简介
5. 点击海报播放（MPV）

## 📂 数据存储

| 路径 | 内容 |
|---|---|
| `~/.fntv/config.json` | 应用配置（凭据经系统密钥环加密） |
| `~/.fntv/library/` | 媒体库数据库 |
| `~/.fntv/library-cache/` | 海报 / 剧照缓存 |
| `~/.fntv/logs/` | 运行日志（自动脱敏） |

## ❓ 常见问题

### 1. 定制 mpv（补帧滤镜、快捷键等）

自动方式：克隆 [fntv-mpv-config](https://github.com/QiaoKes/fntv-mpv-config) 自行修改；手动方式：修改安装目录下 `third_party/fntv-mpv/portable_config`（`input.conf` 为快捷键）。注意：重装或更新会清空安装目录，请备份自定义插件。

### 2. 弹幕相关

查看 uosc_danmaku 文档，调整 `portable_config/script-opts/uosc_danmaku.conf`；弹幕视频掉帧可关闭其中的 fps 平滑滤镜。

### 3. 双显卡机器播放卡顿（调用核显）

- NVIDIA 控制面板 → 管理 3D 设置 → 程序设置 → 添加飞牛影视 → 选择高性能
- 或：系统设置 → 屏幕 → 图形显示 → 添加飞牛影视 → 选择高性能

## 🙏 特别感谢

- [QiaoKes/fntv-electron](https://github.com/QiaoKes/fntv-electron) — 本项目的基础
- [enable-chromium-hevc-hardware-decoding](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding) — Chromium HEVC 硬解码支持
- [electron-media-patch](https://github.com/5rahim/electron-media-patch) — Electron 硬解码补丁
- [fnToPotplayer](https://github.com/gudqs7/fnToPotplayer) — 飞牛影视调用 PotPlayer
- [fnos-tv](https://github.com/thshu/fnos-tv) — 支持弹幕的飞牛影视
- [uosc_danmaku](https://github.com/Tony15246/uosc_danmaku) — 基于 uosc 的弹幕插件

## 📄 许可证

本项目采用 [GPL-3.0 许可证](LICENSE)，基于 QiaoKes/fntv-electron 修改。

Copyright (c) 2025 Tag mig hånden（原项目）
