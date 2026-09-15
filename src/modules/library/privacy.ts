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
