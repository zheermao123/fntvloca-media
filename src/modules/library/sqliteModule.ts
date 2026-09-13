import { createRequire } from 'module';

export type SqliteStatement = {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
};

export type SqliteDatabase = {
    exec(sql: string): void;
    prepare(sql: string): SqliteStatement;
    close(): void;
};

export type SqliteModule = {
    DatabaseSync: new (path: string, options?: Record<string, unknown>) => SqliteDatabase;
};

const nodeRequire = createRequire(__filename);

export function loadSqliteModule(): SqliteModule | null {
    try {
        const mod: unknown = nodeRequire('node:sqlite');
        if (mod !== null && typeof mod === 'object' && 'DatabaseSync' in mod) {
            const candidate = mod as { DatabaseSync?: unknown };
            if (typeof candidate.DatabaseSync === 'function') {
                return candidate as SqliteModule;
            }
        }
        return null;
    } catch {
        return null;
    }
}
