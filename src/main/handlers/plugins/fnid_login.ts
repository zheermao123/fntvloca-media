import { BrowserWindow, IpcMainEvent } from 'electron';
import { getMainWindow } from '../../common/mainwin';
import { ApiService } from '../../../modules/fn_api/api';
import { request, HttpMethod } from '../../../modules/fn_api/request';
import { isTrusted } from '../../../modules/cert_trust';
import { restoreCookies } from '../../../modules/fn_config/cookie';
import * as fnConfig from '../../../modules/fn_config/config';
import * as log from '../../../modules/logger';
import { applyVerifiedOriginToFnConnectBaseUrl, resolveFnConnectBaseUrl } from '../core/fnConnect';
import {
    AccessCodeVerificationError,
    establishAccessCodeSession,
} from '../../common/accessCodeSession';

/**
 * FN ID 登录插件
 * 通过 FN Connect OAuth 流程实现 FN ID 登录
 */

interface LoginData {
    domain: string;
    username: string;
    password: string;
    accessCode?: string;
    useHttps?: boolean;
}

/**
 * 判断输入是否为 FN ID
 * 规则：不包含 '.'，长度 6-30 位
 */
export function isFnId(domain: string): boolean {
    if (!domain) return false;
    const trimmed = domain.trim();
    return !trimmed.includes('.') && trimmed.length >= 6 && trimmed.length <= 30;
}

/**
 * 构建 FN Connect URL
 * FN ID 归一化为 https://5ddd.com/{fnid}
 */
function buildFnConnectUrl(fnId: string): string {
    return `https://5ddd.com/${fnId.trim()}`;
}

/**
 * 生成注入 WebView 的 JavaScript 脚本
 * 功能：
 * 1. Hook XHR 和 Fetch，拦截 /oauthapi/authorize 响应获取 code
 * 2. 拦截 /sac/rpcproxy/v1/new-user-guide/status 获取 Cookie
 * 3. 在 /login 页面自动填充用户名密码并提交
 * 4. 在 /signin 页面自动点击授权按钮
 * 5. 在非 /login 页面获取 sys_config
 */
function getInjectionScript(username: string, password: string): string {
    return `
        (function() {
            console.log("[fntv-electron] Injecting FN ID Login Interceptor...");

            var AUTO_LOGIN_USER = ${JSON.stringify(username)};
            var AUTO_LOGIN_PASS = ${JSON.stringify(password)};

            function postMessage(payload) {
                try {
                    payload = payload || {};
                    payload.cookie = document.cookie;
                    window.__fntvBridge(JSON.stringify(payload));
                } catch (e) {
                    console.error("[fntv-electron] postMessage error:", e);
                }
            }

            function triggerInput(input, value) {
                var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                nativeInputValueSetter.call(input, value);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // 在登录页面自动填充用户名密码
            if (window.location.href.indexOf('/login') !== -1) {
                setTimeout(function() {
                    var uInput = document.querySelector('#username, input[name="username"], input[autocomplete="username"]');
                    var pInput = document.querySelector('#password, input[name="password"], input[type="password"]');
                    if (uInput && AUTO_LOGIN_USER) {
                        triggerInput(uInput, AUTO_LOGIN_USER);
                        if (AUTO_LOGIN_PASS && pInput) {
                            triggerInput(pInput, AUTO_LOGIN_PASS);
                            // 自动点击登录按钮
                            setTimeout(function() {
                                var btn = document.querySelector('button[type="submit"]');
                                if (btn) btn.click();
                            }, 200);
                        }
                    }
                }, 200);
            }

            // 在 /signin 页面自动点击授权按钮
            if (window.location.href.indexOf('/signin') !== -1) {
                setTimeout(function() {
                    var btns = document.querySelectorAll('button');
                    for (var i = 0; i < btns.length; i++) {
                        if (/授权|允许|同意/.test(btns[i].innerText || '')) {
                            btns[i].click();
                            break;
                        }
                    }
                }, 200);
            }

            // Hook XMLHttpRequest
            var originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
                this._method = method;
                this._url = url;
                this._headers = {};
                return originalOpen.apply(this, arguments);
            };

            var originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
            XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
                this._headers[header] = value;
                return originalSetRequestHeader.apply(this, arguments);
            };

            var originalSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.send = function(body) {
                var self = this;
                var originalOnReadyStateChange = self.onreadystatechange;
                self.onreadystatechange = function() {
                    if (self.readyState === 4) {
                        if (self._url && self._url.indexOf("/oauthapi/authorize") !== -1) {
                            try {
                                var json = JSON.parse(self.responseText || "{}");
                                var code = json && json.data ? json.data.code : null;
                                if (code) {
                                    postMessage({ type: "Response", url: self._url, code: String(code) });
                                } else {
                                    postMessage({ type: "Response", url: self._url, body: self.responseText || "" });
                                }
                            } catch (e) {
                                postMessage({ type: "Response", url: self._url, body: self.responseText || "" });
                            }
                        }
                    }
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.apply(this, arguments);
                    }
                };

                if (this._url && this._url.indexOf("/sac/rpcproxy/v1/new-user-guide/status") !== -1) {
                    postMessage({ type: "XHR", url: this._url, headers: (this._headers || {}) });
                }
                return originalSend.apply(this, arguments);
            };

            // Hook Fetch
            var originalFetch = window.fetch;
            window.fetch = function(input, init) {
                var url = input;
                if (typeof input === 'object' && input.url) {
                    url = input.url;
                }

                if (url && url.indexOf("/sac/rpcproxy/v1/new-user-guide/status") !== -1) {
                    var headers = {};
                    if (init && init.headers) {
                        var h = init.headers;
                        if (h instanceof Headers) {
                            h.forEach(function(value, key) { headers[key] = value; });
                        } else {
                            for (var key in h) {
                                if (h.hasOwnProperty(key)) headers[key] = h[key];
                            }
                        }
                    }
                    postMessage({ type: "XHR", url: url, headers: headers });
                }

                return originalFetch.apply(this, arguments).then(function(response) {
                    if (url && url.indexOf("/oauthapi/authorize") !== -1) {
                        var clone = response.clone();
                        clone.text().then(function(text) {
                            try {
                                var json = JSON.parse(text || "{}");
                                var code = json && json.data ? json.data.code : null;
                                if (code) {
                                    postMessage({ type: "Response", url: url, code: String(code) });
                                } else {
                                    postMessage({ type: "Response", url: url, body: text || "" });
                                }
                            } catch (e) {
                                postMessage({ type: "Response", url: url, body: text || "" });
                            }
                        });
                    }
                    return response;
                });
            };

            // 获取 sys_config（在非 /login 页面执行）
            function fetchSysConfigOnce() {
                try {
                    if (window.__fntv_sys_config_requested) return;
                    if (window.location.href.indexOf('/login') !== -1) return;
                    window.__fntv_sys_config_requested = true;
                    fetch('/v/api/v1/sys/config', { credentials: 'include' })
                        .then(function(r) {
                            var contentType = r.headers.get('content-type') || '';
                            if (!r.ok || contentType.indexOf('application/json') === -1) {
                                throw new Error('sys/config did not return JSON');
                            }
                            return r.text();
                        })
                        .then(function(text) {
                            postMessage({
                                type: "SysConfig",
                                url: "/v/api/v1/sys/config",
                                body: text || "",
                                pageUrl: String(window.location.href || "")
                            });
                        })
                        .catch(function() {
                            window.__fntv_sys_config_requested = false;
                        });
                } catch (e) {
                    window.__fntv_sys_config_requested = false;
                }
            }

            setTimeout(fetchSysConfigOnce, 800);
            console.log("[fntv-electron] FN ID Login Interceptor Injected.");
        })();
    `;
}

function getAccessCodeInjectionScript(accessCode: string): string {
    return `
        (function() {
            var input = document.querySelector('#access-code-input, input[name="access-code"]');
            var form = input ? input.closest('form') : null;
            var title = document.querySelector('#page-title');
            if (!input || !form || !title || title.textContent.trim() !== '请输入访问码') return false;
            var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, ${JSON.stringify(accessCode)});
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof form.requestSubmit === 'function') {
                form.requestSubmit();
            } else {
                var submit = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submit) submit.click();
            }
            return true;
        })();
    `;
}

/**
 * 处理 FN ID OAuth 登录流程
 */
export async function handleFnIdLogin(event: IpcMainEvent, loginData: LoginData): Promise<void> {
    const fnId = loginData.domain.trim();
    const fnConnectUrl = buildFnConnectUrl(fnId);
    const accessCode = loginData.accessCode?.trim() || '';
    log.info('[FN ID] 开始 FN ID 登录');

    let oauthWindow: BrowserWindow | null = null;
    let baseUrl = '';
    let cookieString = '';
    let sysConfigLoaded = false;
    let authRequested = false;
    let loginCompleted = false;
    let cookieCheckInProgress = false;

    try {
        // 创建 OAuth 登录窗口
        oauthWindow = new BrowserWindow({
            width: 800,
            height: 600,
            show: false, // Wait for ready-to-show
            title: 'FN ID 登录',
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                // 每次登录使用临时隔离会话，避免旧 token 被误判为本次登录结果。
                partition: `fnid-oauth-${Date.now()}`,
            }
        });

        // 平滑显示
        oauthWindow.once('ready-to-show', () => {
            oauthWindow?.show();
        });

        const oauthSession = oauthWindow.webContents.session;

        async function establishTargetSession(targetBaseUrl: string): Promise<string> {
            if (!accessCode) return targetBaseUrl;
            const result = await establishAccessCodeSession(targetBaseUrl, accessCode);
            return applyVerifiedOriginToFnConnectBaseUrl(targetBaseUrl, result.baseUrl);
        }

        // 为 FN Connect 域名设置 mode=relay Cookie
        await oauthSession.cookies.set({
            url: fnConnectUrl,
            name: 'mode',
            value: 'relay',
            path: '/',
            secure: true,
        });

        // 注册 JS bridge 用于 WebView 与主进程通信
        oauthWindow.webContents.on('did-finish-load', async () => {
            if (!oauthWindow) return;
            try {
                const isAccessCodePage = accessCode
                    ? await oauthWindow.webContents.executeJavaScript(
                        `(() => {
                            const input = document.querySelector('#access-code-input, input[name="access-code"]');
                            const title = document.querySelector('#page-title');
                            return Boolean(input && input.closest('form') && title && title.textContent.trim() === '请输入访问码');
                        })()`,
                    )
                    : false;
                if (isAccessCodePage) {
                    await oauthWindow.webContents
                        .executeJavaScript(getAccessCodeInjectionScript(accessCode))
                        .catch(() => {
                            log.error('[FN ID] 访问码页面自动提交失败');
                        });
                    return;
                }

                const script = getInjectionScript(loginData.username, loginData.password);
                await oauthWindow.webContents.executeJavaScript(`
                    window.__fntvBridge = function(msg) {
                        console.log('__FNTV_BRIDGE__:' + msg);
                    };
                    ${script}
                `);
            } catch (err) {
                log.error('[FN ID] JS 注入失败:', err);
            }
        });

        // 创建一个 Promise 来等待登录完成
        const loginPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('FN ID 登录超时（120秒）'));
            }, 120000);

            async function completeLogin(token: string, targetBaseUrl: string): Promise<void> {
                if (loginCompleted) return;
                loginCompleted = true;

                try {
                    const resolvedTargetBaseUrl = await establishTargetSession(targetBaseUrl);
                    const restored = await restoreCookies(resolvedTargetBaseUrl, token, true);
                    if (!restored) throw new Error('无法恢复 FN Connect 登录状态');

                    fnConfig.saveConfig({
                        account: loginData.username,
                        domain: resolvedTargetBaseUrl,
                        token,
                        accessCode,
                        useHttps: resolvedTargetBaseUrl.startsWith('https://'),
                    });
                    fnConfig.addHistory({
                        domain: fnId,
                        account: loginData.username,
                        password: loginData.password,
                        accessCode,
                        useHttps: true,
                    });

                    const mainWindow = getMainWindow();
                    log.info('[FN ID] 登录成功，跳转到主页面');
                    await mainWindow.loadURL(`${resolvedTargetBaseUrl}/v`);

                    clearTimeout(timeout);
                    resolve();
                } catch (error) {
                    loginCompleted = false;
                    reject(error);
                }
            }

            async function tryCompleteFromSession(): Promise<void> {
                if (loginCompleted || authRequested || cookieCheckInProgress || !oauthWindow || oauthWindow.isDestroyed()) return;
                cookieCheckInProgress = true;

                try {
                    const currentUrl = oauthWindow.webContents.getURL();
                    if (!currentUrl || currentUrl === 'about:blank') return;

                    const cookies = await oauthSession.cookies.get({ name: 'Trim-MC-token' });
                    const tokenCookie = cookies.find((cookie) => cookie.value.length > 0);
                    if (!tokenCookie) return;

                    const targetBaseUrl = await establishTargetSession(
                        resolveFnConnectBaseUrl(currentUrl, fnConnectUrl),
                    );
                    const verification = await new ApiService(targetBaseUrl, tokenCookie.value).getUserInfo(5000, 0);
                    if (!verification?.success) {
                        log.info('[FN ID] 当前 Cookie 不是可用的媒体 token，继续 OAuth 流程');
                        return;
                    }

                    log.info(`[FN ID] 检测到有效登录 Cookie，使用当前连接完成登录: ${targetBaseUrl}`);
                    authRequested = true;
                    await completeLogin(tokenCookie.value, targetBaseUrl);
                } finally {
                    cookieCheckInProgress = false;
                }
            }

            oauthWindow!.webContents.on('did-finish-load', () => {
                setTimeout(() => {
                    tryCompleteFromSession().catch((error: unknown) => {
                        log.error('[FN ID] 检查登录 Cookie 失败:', error);
                    });
                }, 300);
            });

            oauthSession.cookies.on('changed', (_event, cookie, _cause, removed) => {
                if (removed || cookie.name !== 'Trim-MC-token' || !cookie.value) return;
                tryCompleteFromSession().catch((error: unknown) => {
                    log.error('[FN ID] Cookie 变更处理失败:', error);
                });
            });

            // 处理从 WebView 收到的消息
            async function handleMessage(messageData: any) {
                try {
                    const type = messageData.type;
                    const url = messageData.url || '';

                    // 处理 XHR 拦截（获取 Cookie）
                    if (type === 'XHR' && url.includes('/sac/rpcproxy/v1/new-user-guide/status')) {
                        const cookie = messageData.cookie;
                        if (cookie) {
                            cookieString = cookie;
                            log.info('[FN ID] 获取到 Cookie');

                            // 获取 sysConfig
                            if (!sysConfigLoaded) {
                                sysConfigLoaded = true;
                                try {
                                    await handleSysConfig(cookie);
                                } catch (err) {
                                    log.error('[FN ID] 获取系统配置失败:', err);
                                    sysConfigLoaded = false;
                                }
                            }
                        }
                    }

                    // 处理 SysConfig 响应（来自 WebView 内部 fetch）
                    if (type === 'SysConfig') {
                        if (sysConfigLoaded && baseUrl) return; // 已处理过
                        const body = messageData.body;
                        if (!body) return;

                        try {
                            if (typeof body !== 'string' || !body.trimStart().startsWith('{')) {
                                log.warn('[FN ID] sys/config 未返回 JSON，等待登录 Cookie 或 OAuth 回调');
                                return;
                            }
                            const bodyJson = JSON.parse(body);
                            const data = bodyJson.data;
                            if (!data || !data.nas_oauth) return;

                            const appId = data.nas_oauth.app_id;
                            const oauthUrl = data.nas_oauth.url || '';

                            // 确定 baseUrl
                            if (oauthUrl && oauthUrl !== '://') {
                                baseUrl = oauthUrl;
                            } else if (messageData.pageUrl) {
                                const parsed = new URL(messageData.pageUrl);
                                baseUrl = `${parsed.protocol}//${parsed.host}`;
                            }

                            if (baseUrl && appId) {
                                sysConfigLoaded = true;
                                const redirectUri = `${baseUrl}/v/oauth/result`;
                                const targetUrl = `${baseUrl}/signin?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                                log.info(`[FN ID] 跳转到 OAuth 授权页面: ${targetUrl}`);

                                // 转发 Cookie 到新域名
                                if (cookieString) {
                                    const domain = baseUrl.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
                                    const cookies = cookieString.split(';');
                                    for (const c of cookies) {
                                        const parts = c.trim().split('=');
                                        if (parts.length >= 2) {
                                            await oauthSession.cookies.set({
                                                url: baseUrl,
                                                name: parts[0].trim(),
                                                value: parts.slice(1).join('=').trim(),
                                                path: '/',
                                                domain: domain,
                                            }).catch(() => { });
                                        }
                                    }
                                    // 确保 mode=relay 被设置
                                    await oauthSession.cookies.set({
                                        url: baseUrl,
                                        name: 'mode',
                                        value: 'relay',
                                        path: '/',
                                    }).catch(() => { });
                                }

                                if (oauthWindow) {
                                    oauthWindow.loadURL(targetUrl);
                                }
                            }
                        } catch (err) {
                            log.error('[FN ID] 解析 SysConfig 失败:', err);
                        }
                    }

                    // 处理 OAuth 授权码响应
                    if (type === 'Response' && url.includes('/oauthapi/authorize')) {
                        if (authRequested) return;

                        let code = messageData.code;
                        if (!code && messageData.body) {
                            try {
                                const bodyJson = JSON.parse(messageData.body);
                                code = bodyJson.data?.code;
                            } catch (e) { }
                        }

                        if (code) {
                            authRequested = true;
                            log.info('[FN ID] 获取到授权码，开始换取 token');

                            try {
                                // 使用 baseUrl 创建 API 实例并换取 token
                                baseUrl = await establishTargetSession(baseUrl);
                                const fnapi = new ApiService(baseUrl);
                                const authResponse = await fnapi.auth(code);

                                if (!authResponse || !authResponse.success || !authResponse.data?.token) {
                                    const msg = authResponse?.message || '换取 token 失败';

                                    log.error(`[FN ID] ${baseUrl} 授权失败: ${msg}`);

                                    authRequested = false;
                                    reject(new Error(msg));
                                    return;
                                }

                                const token = authResponse.data.token;
                                log.info('[FN ID] 获取 token 成功');

                                await completeLogin(token, baseUrl);
                            } catch (err) {
                                authRequested = false;
                                log.error('[FN ID] Token 交换失败:', err);
                                reject(err);
                            }
                        }
                    }
                } catch (err) {
                    log.error('[FN ID] 消息处理错误:', err);
                }
            }

            // 通过 API 获取 sys_config（作为备选方案）
            async function handleSysConfig(cookie: string) {
                if (baseUrl && sysConfigLoaded) return;

                // 从当前 URL 获取 baseUrl
                const currentUrl = oauthWindow?.webContents.getURL() || '';
                if (!currentUrl) return;

                const parsed = new URL(currentUrl);
                const currentBaseUrl = `${parsed.protocol}//${parsed.host}`;

                // 使用获取到的 Cookie，通过 API 获取 sys_config
                const extraHeaders: Record<string, string> = { 'Cookie': cookie + '; mode=relay' };

                const configResponse = await request(
                    currentBaseUrl,
                    '/v/api/v1/sys/config',
                    HttpMethod.GET,
                    '',
                    undefined,
                    extraHeaders
                );

                if (configResponse.success && configResponse.data) {
                    const data = configResponse.data as any;
                    const oauth = data.nas_oauth;
                    if (oauth && oauth.app_id) {
                        let targetBaseUrl = currentBaseUrl;
                        if (oauth.url && oauth.url !== '://') {
                            targetBaseUrl = oauth.url;
                        }
                        baseUrl = targetBaseUrl;

                        const appId = oauth.app_id;
                        const redirectUri = `${targetBaseUrl}/v/oauth/result`;
                        const targetUrl = `${targetBaseUrl}/signin?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                        log.info(`[FN ID] 通过 API 获取 OAuth 配置，跳转: ${targetUrl}`);

                        // 转发 Cookie
                        const domain = targetBaseUrl.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
                        const cookies = cookie.split(';');
                        for (const c of cookies) {
                            const parts = c.trim().split('=');
                            if (parts.length >= 2) {
                                await oauthSession.cookies.set({
                                    url: targetBaseUrl,
                                    name: parts[0].trim(),
                                    value: parts.slice(1).join('=').trim(),
                                    path: '/',
                                    domain: domain,
                                }).catch(() => { });
                            }
                        }
                        await oauthSession.cookies.set({
                            url: targetBaseUrl,
                            name: 'mode',
                            value: 'relay',
                            path: '/',
                        }).catch(() => { });

                        if (oauthWindow) {
                            oauthWindow.loadURL(targetUrl);
                        }
                    }
                }
            }

            // 监听 console 消息（JS bridge）
            oauthWindow!.webContents.on('console-message', (_event, _level, message) => {
                if (message.startsWith('__FNTV_BRIDGE__:')) {
                    const jsonStr = message.substring('__FNTV_BRIDGE__:'.length);
                    try {
                        const data = JSON.parse(jsonStr);
                        handleMessage(data);
                    } catch (err) {
                        log.error('[FN ID] 解析 bridge 消息失败:', err);
                    }
                }
            });

            // 窗口关闭时取消登录
            oauthWindow!.on('closed', () => {
                oauthWindow = null;
                clearTimeout(timeout);
                if (!authRequested && !loginCompleted) {
                    reject(new Error('用户关闭了登录窗口'));
                }
            });
        });

        // 加载 FN Connect URL
        oauthWindow.loadURL(fnConnectUrl);

        // 等待登录完成
        await loginPromise;

        // 关闭 OAuth 窗口
        if (oauthWindow && !oauthWindow.isDestroyed()) {
            oauthWindow.close();
        }

    } catch (error: any) {
        const isAccessCodeError = error instanceof AccessCodeVerificationError;
        log.error('[FN ID] 登录失败:', isAccessCodeError ? error.reason : error);

        // 关闭 OAuth 窗口
        if (oauthWindow && !oauthWindow.isDestroyed()) {
            oauthWindow.close();
        }

        event.reply('login-error', {
            title: isAccessCodeError && error.reason === 'rejected' ? '访问码错误' : 'FN ID 登录失败',
            message: isAccessCodeError
                ? (error.reason === 'rejected'
                    ? '访问码错误，请检查后重试。'
                    : '无法连接到访问码验证服务，请检查地址、证书或网络连接。')
                : error.message || '通过 FN ID 登录时发生错误，请检查 FN ID 和网络连接。'
        });
    }
}
