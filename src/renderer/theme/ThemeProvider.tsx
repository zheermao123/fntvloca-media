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

function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children, initialMode = DEFAULT_THEME_MODE }: { children: ReactNode; initialMode?: ThemeMode }) {
    const [mode, setModeState] = useState<ThemeMode>(initialMode);
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

    const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
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
