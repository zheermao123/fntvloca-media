import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const PROXY_SECRET_FILENAME = 'proxy-secret';
const PROXY_SECRET_PATTERN = /^[0-9a-f]{64}$/;

export function isValidProxySecret(value: string): boolean {
    return PROXY_SECRET_PATTERN.test(value);
}

function writeSecretAtomically(secretPath: string, secret: string): void {
    const temporaryPath = `${secretPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, secret, {
            encoding: 'utf8',
            flag: 'wx',
            mode: 0o600,
        });
        fs.renameSync(temporaryPath, secretPath);
        fs.chmodSync(secretPath, 0o600);
    } finally {
        fs.rmSync(temporaryPath, { force: true });
    }
}

export function loadOrCreateProxySecret(userDataDir: string): string {
    fs.mkdirSync(userDataDir, { recursive: true });
    const secretPath = path.join(userDataDir, PROXY_SECRET_FILENAME);

    try {
        const existingSecret = fs.readFileSync(secretPath, 'utf8');
        if (isValidProxySecret(existingSecret)) {
            fs.chmodSync(secretPath, 0o600);
            return existingSecret;
        }
    } catch (error) {
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode !== 'ENOENT') throw error;
    }

    const secret = randomBytes(32).toString('hex');
    writeSecretAtomically(secretPath, secret);
    return secret;
}
