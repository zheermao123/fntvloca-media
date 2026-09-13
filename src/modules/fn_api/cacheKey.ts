import * as crypto from 'node:crypto';

export function createApiCacheKey(baseURL: string, token: string, operation: string, args: unknown[]): string {
    const tokenFingerprint = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
    return `${baseURL}_${tokenFingerprint}_${operation}_${JSON.stringify(args)}`;
}
