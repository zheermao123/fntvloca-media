import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

const STORAGE_KEY = 'fntv.ui2.libraryPreferences.v1';
const SORT_KEYS: SortKey[] = ['added', 'title', 'year', 'recentPlayed'];
const WATCHED_KEYS: WatchedFilterKey[] = ['all', 'watched', 'unwatched'];
const FAVORITE_KEYS: FavoriteFilterKey[] = ['all', 'fav', 'unfav'];
const VIEW_MODES: ViewMode[] = ['grid', 'list'];

const LibraryPreferencesContext = createContext<LibraryPreferencesContextValue | null>(null);

function loadPreferences(): LibraryPreferences {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return DEFAULT_PREFERENCES;
        }
        const parsed = JSON.parse(raw) as Partial<LibraryPreferences>;
        return {
            sort: parsed.sort && SORT_KEYS.includes(parsed.sort) ? parsed.sort : DEFAULT_PREFERENCES.sort,
            watched:
                parsed.watched && WATCHED_KEYS.includes(parsed.watched)
                    ? parsed.watched
                    : DEFAULT_PREFERENCES.watched,
            favorite:
                parsed.favorite && FAVORITE_KEYS.includes(parsed.favorite)
                    ? parsed.favorite
                    : DEFAULT_PREFERENCES.favorite,
            view: parsed.view && VIEW_MODES.includes(parsed.view) ? parsed.view : DEFAULT_PREFERENCES.view,
        };
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

export function LibraryPreferencesProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<LibraryPreferences>(loadPreferences);
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        } catch {
            // localStorage 不可用时仅保留内存态。
        }
    }, [preferences]);
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
