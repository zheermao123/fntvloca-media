import crypto from 'crypto';

/**
 * 隐私模式密码：仅保存 scrypt 加盐哈希（不可逆），不保存明文。
 * 说明：隐私模式是"界面隐藏级"隐私（内容未加密），用于避免媒体在正常界面暴露。
 */
const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

export const PRIVACY_PASSWORD_MIN_LENGTH = 4;

/** 解锁状态只存内存：退出隐私模式或重启应用即失效 */
let privacyUnlocked = false;

export function isPrivacyUnlocked(): boolean {
    return privacyUnlocked;
}

export function setPrivacyUnlocked(value: boolean): void {
    privacyUnlocked = value;
}

/** "继续观看"返回条数上限 */
export const CONTINUE_LIST_LIMIT = 20;
/** 取数扫描窗口：先多取再按可见性过滤，保证两种模式互不影响（隐私内容不得挤掉公开候选） */
export const CONTINUE_SCAN_LIMIT = 500;

/**
 * 按可见性裁剪"继续观看"列表：
 * 先按可见性过滤，再截取上限 —— 保证隐私模式与正常模式的列表互不影响。
 */
export function takeContinueByVisibility<T extends { item: { sourceId: string } }>(
    entries: readonly T[],
    privateSourceIds: ReadonlySet<string>,
    wantPrivate: boolean,
    limit: number
): T[] {
    return entries.filter((entry) => privateSourceIds.has(entry.item.sourceId) === wantPrivate).slice(0, limit);
}

/**
 * "继续观看"真续看点：按 (season, episode) 升序的剧集列表中，
 * 找出进度最前沿（有观看活动的最后一集）：
 * - 前沿未看完 → 返回前沿集本身（续播它）
 * - 前沿已看完 → 返回下一集（跨季进位；即使还没开播）
 * - 整部已全部看完 → 返回 null（不再出现在继续观看）
 */
export function resolveShowContinuePoint<
    T extends { id: string; watched: boolean; positionTs: number; durationTs: number; lastPlayedAt: number | null }
>(episodes: readonly T[]): T | null {
    let frontier: T | null = null;
    let frontierIndex = -1;
    for (let i = 0; i < episodes.length; i += 1) {
        const ep = episodes[i];
        if (ep.watched || ep.positionTs > 0 || (ep.lastPlayedAt ?? 0) > 0) {
            frontier = ep;
            frontierIndex = i;
        }
    }
    if (!frontier) {
        return null;
    }
    const frontierDone = frontier.watched || (frontier.durationTs > 0 && frontier.positionTs >= 0.98 * frontier.durationTs);
    if (!frontierDone) {
        return frontier;
    }
    return episodes[frontierIndex + 1] ?? null;
}

export function isValidPrivacyPassword(password: unknown): password is string {
    return typeof password === 'string' && password.trim().length >= PRIVACY_PASSWORD_MIN_LENGTH;
}

export function hashPrivacyPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_BYTES);
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
    return `scrypt$${SCRYPT_N}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPrivacyPassword(password: string, stored: string | null | undefined): boolean {
    if (typeof password !== 'string' || password.length === 0 || !stored) {
        return false;
    }
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
        return false;
    }
    const n = Number(parts[1]);
    if (!Number.isFinite(n) || n <= 0) {
        return false;
    }
    const salt = Buffer.from(parts[2], 'base64');
    const expected = Buffer.from(parts[3], 'base64');
    if (salt.length === 0 || expected.length === 0) {
        return false;
    }
    const derived = crypto.scryptSync(password, salt, expected.length, { N: n });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}
