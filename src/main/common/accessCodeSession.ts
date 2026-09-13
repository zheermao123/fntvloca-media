import { net, session, type Session } from 'electron';
import { clearAccessGrants, setAccessGrant } from '../../modules/fn_api/accessGrant';

const MAX_REDIRECTS = 5;
const REJECTED_STATUS_CODES = new Set([401, 403, 429]);
const EXCLUDED_COOKIE_NAMES = new Set(['mode', 'trim-mc-token']);

type GatewayCookie = {
    name: string;
    value: string;
};

type GatewayRequestResult = {
    status: number;
    url: string;
};

export type GatewaySession = {
    cookies: {
        get(filter: { url: string }): Promise<GatewayCookie[]>;
    };
};

export type GatewayRequester = (
    gatewaySession: GatewaySession,
    url: string,
    headers: Record<string, string>,
) => Promise<GatewayRequestResult>;

export type AccessCodeSessionResult = {
    baseUrl: string;
    cookie: string;
};

export class AccessCodeVerificationError extends Error {
    readonly reason: 'rejected' | 'network';

    constructor(reason: 'rejected' | 'network', message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'AccessCodeVerificationError';
        this.reason = reason;
    }
}

function parseBaseUrl(value: string): URL {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new AccessCodeVerificationError('network', '访问码验证地址无效');
    }
    return url;
}

export function resolveAccessCodeRedirect(sourceValue: string, targetValue: string): URL {
    const source = parseBaseUrl(sourceValue);
    const target = new URL(targetValue, source);
    const isWebProtocol = target.protocol === 'http:' || target.protocol === 'https:';
    const isSameHost = source.hostname === target.hostname;
    const isSecureTransition = !(source.protocol === 'https:' && target.protocol === 'http:');
    if (!isWebProtocol || !isSameHost || !isSecureTransition) {
        throw new AccessCodeVerificationError('network', '访问码验证拒绝跨主机或不安全重定向');
    }
    return target;
}

function serializeCookies(cookies: GatewayCookie[]): string {
    return cookies
        .filter(cookie => cookie.name && !EXCLUDED_COOKIE_NAMES.has(cookie.name.toLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');
}

export function encodeAccessCode(accessCode: string): string {
    return Buffer.from(accessCode, 'utf8').toString('base64');
}

export const requestAccessCode: GatewayRequester = (gatewaySession, url, headers) => {
    return new Promise((resolve, reject) => {
        let currentUrl = parseBaseUrl(url);
        let redirects = 0;
        let settled = false;
        const request = net.request({
            method: 'GET',
            url: currentUrl.toString(),
            session: gatewaySession as unknown as Session,
            useSessionCookies: true,
            redirect: 'manual',
        });
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            request.abort();
            reject(new AccessCodeVerificationError('network', '访问码验证请求超时'));
        }, 10000);

        for (const [name, value] of Object.entries(headers)) request.setHeader(name, value);

        request.on('redirect', (_statusCode, _method, redirectUrl) => {
            try {
                redirects++;
                if (redirects > MAX_REDIRECTS) {
                    throw new AccessCodeVerificationError('network', '访问码验证重定向次数过多');
                }
                currentUrl = resolveAccessCodeRedirect(currentUrl.toString(), redirectUrl);
                request.followRedirect();
            } catch (error) {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                request.abort();
                reject(error);
            }
        });
        request.on('response', response => {
            response.on('data', () => undefined);
            response.on('end', () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve({ status: response.statusCode, url: currentUrl.toString() });
            });
            response.on('error', error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                reject(error);
            });
        });
        request.on('error', error => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            reject(error);
        });
        request.end();
    });
};

export async function establishAccessCodeSession(
    baseUrl: string,
    accessCode: string,
    gatewaySession: GatewaySession = session.fromPartition('persist:fntv') as unknown as GatewaySession,
    requester: GatewayRequester = requestAccessCode,
): Promise<AccessCodeSessionResult> {
    const initialUrl = parseBaseUrl(baseUrl);
    const normalizedCode = accessCode.trim();
    // The app has a single active login. Drop grants from previous attempts,
    // including origins discovered through an earlier port redirect.
    clearAccessGrants();
    if (!normalizedCode) {
        return { baseUrl: initialUrl.origin, cookie: '' };
    }

    const verificationUrl = new URL('/access_code_verify', initialUrl);
    let response: GatewayRequestResult;

    try {
        response = await requester(gatewaySession, verificationUrl.toString(), {
            'x-access-code': encodeAccessCode(normalizedCode),
            'x-access-source': 'web',
        });
    } catch (error) {
        if (error instanceof AccessCodeVerificationError) throw error;
        throw new AccessCodeVerificationError('network', '无法连接到访问码验证服务', { cause: error });
    }

    if (REJECTED_STATUS_CODES.has(response.status)) {
        throw new AccessCodeVerificationError('rejected', '访问码错误');
    }
    if (response.status < 200 || response.status >= 300) {
        throw new AccessCodeVerificationError('network', `访问码验证服务返回 HTTP ${response.status}`);
    }

    const resolvedUrl = parseBaseUrl(response.url);
    let cookies: GatewayCookie[];
    try {
        cookies = await gatewaySession.cookies.get({ url: `${resolvedUrl.origin}/` });
    } catch (error) {
        throw new AccessCodeVerificationError('network', '无法读取访问码网关会话', { cause: error });
    }
    const cookie = serializeCookies(cookies);
    if (!cookie) {
        throw new AccessCodeVerificationError('network', '访问码验证成功但未建立网关会话');
    }
    setAccessGrant(resolvedUrl.origin, cookie);

    return { baseUrl: resolvedUrl.origin, cookie };
}
