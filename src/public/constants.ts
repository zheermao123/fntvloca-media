import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

/**
 * 开发态可通过 FNTV_USER_DATA_DIR 覆盖数据目录（用于隔离 E2E；打包版忽略）。
 */
function resolveUserDataPath(): string {
    const override = app.isPackaged ? undefined : process.env.FNTV_USER_DATA_DIR;
    if (override && override.trim().length > 0) {
        return path.resolve(override.trim());
    }
    return path.join(app.getPath('home'), '.fntv');
}

export const USER_DATA_PATH: string = resolveUserDataPath();
