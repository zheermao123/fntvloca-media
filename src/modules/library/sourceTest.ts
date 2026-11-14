/**
 * B1 媒体源连接测试（Phase 1 后端）。
 * 返回有限枚举结果 + 耗时 + 脱敏消息；不记录、不回显密码/Authorization/带凭据 URL。
 */
import fs from 'fs';
import { probeWebdavRoot } from './webdav';
import type { WebdavProbeReason } from './webdav';

export type SourceTestReason = WebdavProbeReason;

export type SourceTestResult = {
    reachable: boolean;
    latencyMs: number;
    reason?: SourceTestReason;
    message?: string;
};

export type WebdavTestTarget = {
    type: 'webdav';
    url: string;
    username?: string;
    password?: string;
};

function failed(reason: SourceTestReason, message: string, latencyMs: number): SourceTestResult {
    return { reachable: false, latencyMs, reason, message };
}

/** 本地/SMB(UNC) 路径：按现有文件系统路径语义 stat，并确认是文件夹（statFn 供测试注入） */
export async function testLocalRoot(
    rootPath: string,
    statFn: (path: string) => Promise<{ isDirectory: () => boolean }> = (p) => fs.promises.stat(p)
): Promise<SourceTestResult> {
    const started = Date.now();
    const target = rootPath.trim();
    if (!target) {
        return failed('not_found', '路径为空', Date.now() - started);
    }
    try {
        const stat = await statFn(target);
        if (!stat.isDirectory()) {
            return failed('not_found', '路径不是文件夹', Date.now() - started);
        }
        return { reachable: true, latencyMs: Date.now() - started };
    } catch (error) {
        const latencyMs = Date.now() - started;
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') {
            return failed('not_found', '路径不存在或不是文件夹', latencyMs);
        }
        if (code === 'EACCES' || code === 'EPERM') {
            return failed('auth', '没有访问权限', latencyMs);
        }
        return failed('network', '无法访问该路径', latencyMs);
    }
}

/** WebDAV：复用 webdav.ts 的 PROPFIND 解析/认证/超时，单次根探测（Depth:0），不全量扫描 */
export async function testWebdavSource(target: WebdavTestTarget): Promise<SourceTestResult> {
    const started = Date.now();
    const result = await probeWebdavRoot(
        {
            baseUrl: target.url,
            username: target.username,
            password: target.password,
            timeoutMs: 5000,
        },
        { timeoutMs: 5000 }
    );
    const latencyMs = Date.now() - started;
    if (result.ok) {
        return { reachable: true, latencyMs };
    }
    return failed(result.reason, result.message, latencyMs);
}
