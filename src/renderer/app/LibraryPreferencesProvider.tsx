import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { FavoriteFilterKey, SortKey, ViewMode, WatchedFilterKey } from '../pages/library/library.types';

type LibraryPreferences = {
    sort: SortKey;
    watched: WatchedFilterKey;
    favorite: FavoriteFilterKey;
    view: ViewMode;
};

type LibraryPreferencesContextValue = LibraryPreferences & {
    update: (patch: Partial<LibraryPreferences>) => void;
};

const DEFAULT_PREFERENCES: LibraryPreferences = {
    sort: 'added',
    watched: 'all',
    favorite: 'all',
    view: 'grid',
};

const LibraryPreferencesContext = createContext<LibraryPreferencesContextValue | null>(null);

export function LibraryPreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<LibraryPreferences>(DEFAULT_PREFERENCES);
    const update = useCallback((patch: Partial<LibraryPreferences>) => {
        setPreferences((previous) => ({ ...previous, ...patch }));
    }, []);
    const value = useMemo<LibraryPreferencesContextValue>(
        () => ({ ...preferences, update }),
        [preferences, update]
    );
    return <LibraryPreferencesContext.Provider value={value}>{children}</LibraryPreferencesContext.Provider>;
}

export function useLibraryPreferences(): LibraryPreferencesContextValue {
    const value = useContext(LibraryPreferencesContext);
    if (!value) {
        throw new Error('useLibraryPreferences 必须在 LibraryPreferencesProvider 内使用');
    }
    return value;
}
