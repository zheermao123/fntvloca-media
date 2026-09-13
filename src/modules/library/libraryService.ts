import { app } from 'electron';
import path from 'path';
import type { LibraryStore } from './store';
import { createLibraryStore } from './store';

let storeInstance: LibraryStore | null = null;
let cacheDirInstance: string | null = null;

export function getLibraryStore(): LibraryStore {
    if (!storeInstance) {
        storeInstance = createLibraryStore(path.join(app.getPath('userData'), 'library'));
    }
    return storeInstance;
}

export function getLibraryCacheDir(): string {
    if (!cacheDirInstance) {
        cacheDirInstance = path.join(app.getPath('userData'), 'library-cache');
    }
    return cacheDirInstance;
}
