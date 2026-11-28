import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_THEME_MODE, resolveTheme } from './theme';
import type { ResolvedTheme, ThemeMode } from './theme';

type ThemeContextValue = {
    mode: ThemeMode;
    resolved: ResolvedTheme;
    setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'fntv.ui2.themeMode.v1';

function storedMode(): ThemeMode {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME_MODE;
    } catch {
        return DEFAULT_THEME_MODE;
    }
}

function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children, initialMode }: { children: ReactNode; initialMode?: ThemeMode }) {
    const [mode, setModeState] = useState<ThemeMode>(() => initialMode ?? storedMode());
    const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    const resolved = resolveTheme(mode, prefersDark);

    useEffect(() => {
        document.documentElement.dataset.theme = resolved;
    }, [resolved]);

    const setMode = useCallback((next: ThemeMode) => {
        setModeState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // localStorage 不可用时仅保留内存态。
        }
    }, []);
    const value = useMemo<ThemeContextValue>(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const value = useContext(ThemeContext);
    if (!value) {
        throw new Error('useTheme 必须在 ThemeProvider 内使用');
    }
    return value;
}
