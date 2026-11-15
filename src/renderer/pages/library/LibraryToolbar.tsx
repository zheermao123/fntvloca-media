import { Dropdown } from '../../components/ui/Dropdown';
import { IconButton } from '../../components/ui/IconButton';
import { GridIcon, ListIcon } from '../../components/icons';
import { FAVORITE_OPTIONS, SORT_OPTIONS, WATCHED_OPTIONS } from './library.types';
import type { FavoriteFilterKey, SortKey, ViewMode, WatchedFilterKey } from './library.types';

export interface LibraryToolbarProps {
    sort: SortKey;
    watched: WatchedFilterKey;
    favorite: FavoriteFilterKey;
    view: ViewMode;
    onSortChange: (value: SortKey) => void;
    onWatchedChange: (value: WatchedFilterKey) => void;
    onFavoriteChange: (value: FavoriteFilterKey) => void;
    onViewChange: (value: ViewMode) => void;
}

export function LibraryToolbar({
    sort,
    watched,
    favorite,
    view,
    onSortChange,
    onWatchedChange,
    onFavoriteChange,
    onViewChange,
}: LibraryToolbarProps) {
    const sortLabel = SORT_OPTIONS.find((option) => option.id === sort)?.label ?? '排序';
    const watchedLabel = WATCHED_OPTIONS.find((option) => option.id === watched)?.label ?? '观看状态';
    const favoriteLabel = FAVORITE_OPTIONS.find((option) => option.id === favorite)?.label ?? '收藏状态';

    return (
        <div className="library-toolbar">
            <Dropdown
                label={`排序：${sortLabel}`}
                ariaLabel="排序方式"
                items={SORT_OPTIONS.map((option) => ({
                    id: option.id,
                    label: option.label,
                    onSelect: () => onSortChange(option.id),
                }))}
            />
            <Dropdown
                label={`观看：${watchedLabel}`}
                ariaLabel="观看状态筛选"
                items={WATCHED_OPTIONS.map((option) => ({
                    id: option.id,
                    label: option.label,
                    onSelect: () => onWatchedChange(option.id),
                }))}
            />
            <Dropdown
                label={`收藏：${favoriteLabel}`}
                ariaLabel="收藏状态筛选"
                items={FAVORITE_OPTIONS.map((option) => ({
                    id: option.id,
                    label: option.label,
                    onSelect: () => onFavoriteChange(option.id),
                }))}
            />
            <div className="library-toolbar__spacer" />
            <IconButton
                icon={view === 'grid' ? <ListIcon size={15} /> : <GridIcon size={15} />}
                label={view === 'grid' ? '切换为列表视图' : '切换为网格视图'}
                onClick={() => onViewChange(view === 'grid' ? 'list' : 'grid')}
            />
        </div>
    );
}
