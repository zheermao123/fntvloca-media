/** UI 2.0 主题模型（Light 默认；Dark 预留） */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const DEFAULT_THEME_MODE: ThemeMode = 'light';

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
    if (mode === 'system') {
        return prefersDark ? 'dark' : 'light';
    }
    return mode;
}
