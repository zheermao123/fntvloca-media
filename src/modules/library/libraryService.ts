import { app } from 'electron';
import path from 'path';
import * as log from '../logger';
import type { LibraryStore } from './store';
import { createLibraryStore } from './store';
import { migrateShowFavoritesToSeasons } from './favoriteMigration';

let storeInstance: LibraryStore | null = null;
let cacheDirInstance: string | null = null;

export function getLibraryStore(): LibraryStore {
    if (!storeInstance) {
        storeInstance = createLibraryStore(path.join(app.getPath('userData'), 'library'));
        try {
            const migrated = migrateShowFavoritesToSeasons(storeInstance);
            if (migrated > 0) {
                log.i(`[library] 整剧收藏已迁移为按季收藏: ${migrated} 条`);
            }
        } catch (error) {
            log.w('[library] 收藏迁移失败:', error);
        }
    }
    return storeInstance;
}

export function getLibraryCacheDir(): string {
    if (!cacheDirInstance) {
        cacheDirInstance = path.join(app.getPath('userData'), 'library-cache');
    }
    return cacheDirInstance;
}
