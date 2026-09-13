import * as http from 'node:http';
import { PROXY_HOST, PROXY_PORT } from './proxyHealth';

interface PlaybackSessionInput {
    token: string;
    account: string;
    domain: string;
    accessCookie?: string;
    skipVerify: boolean;
    useNasLocal: boolean;
    itemGuids: string[];
}

interface PlaybackSessionResponse {
    session?: string;
}

export function registerPlaybackSession(
    secret: string,
    input: PlaybackSessionInput,
    timeoutMs: number = 5000,
): Promise<string> {
    const body = Buffer.from(JSON.stringify(input), 'utf8');
    return new Promise((resolve, reject) => {
        const request = http.request({
            host: PROXY_HOST,
            port: PROXY_PORT,
            path: '/api/v1/session',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length,
                'X-FNTV-Proxy-Secret': secret,
            },
        }, response => {
            const chunks: Buffer[] = [];
            response.on('data', chunk => chunks.push(Buffer.from(chunk)));
            response.on('end', () => {
                if (response.statusCode !== 201) {
                    reject(new Error(`Proxy 创建播放会话失败 (HTTP ${response.statusCode})`));
                    return;
                }
                try {
                    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as PlaybackSessionResponse;
                    if (!payload.session || !/^[a-f0-9]{64}$/.test(payload.session)) {
                        reject(new Error('Proxy 返回了无效的播放会话'));
                        return;
                    }
                    resolve(payload.session);
                } catch (error) {
                    reject(new Error('Proxy 播放会话响应解析失败', { cause: error }));
                }
            });
        });
        request.setTimeout(timeoutMs, () => request.destroy(new Error('Proxy 创建播放会话超时')));
        request.on('error', reject);
        request.end(body);
    });
}

export function createProxyPlaybackUrl(session: string, itemGuid: string, sourceIndex: number = 0): string {
    const query = new URLSearchParams({ session });
    if (sourceIndex > 0) query.set('sourceIndex', String(sourceIndex));
    return `http://${PROXY_HOST}:${PROXY_PORT}/api/v1/playvideo/${encodeURIComponent(itemGuid)}?${query}`;
}
