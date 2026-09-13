import { safeStorage } from 'electron';

// 与 fn_config 相同的加密前缀策略：凭据只以操作系统密钥环密文落盘
const PREFIX = 'safe-storage:v1:';

export function encryptSecret(value: string): string {
    if (!value) {
        return '';
    }
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('操作系统安全存储不可用，无法保存凭据');
    }
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
        throw new Error('Linux 系统未提供可用的密钥环，拒绝以明文方式保存凭据');
    }
    return PREFIX + safeStorage.encryptString(value).toString('base64');
}

export function decryptSecret(value: string): string {
    if (!value) {
        return '';
    }
    if (!value.startsWith(PREFIX)) {
        // 非加密格式不入库（防御损坏数据），直接返回空值
        return '';
    }
    try {
        return safeStorage.decryptString(Buffer.from(value.slice(PREFIX.length), 'base64'));
    } catch {
        return '';
    }
}
