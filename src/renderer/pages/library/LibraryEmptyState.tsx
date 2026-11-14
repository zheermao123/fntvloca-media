import { EmptyState } from '../../components/ui/EmptyState';
import { FilmIcon } from '../../components/icons';

export function LibraryEmptyState({ privacy }: { privacy: boolean }) {
    return (
        <EmptyState
            icon={<FilmIcon size={26} />}
            title={privacy ? '隐私库暂无内容' : '暂无媒体内容'}
            description={
                privacy
                    ? '当前分类下没有可见的隐私内容。'
                    : '该分类下没有媒体内容。添加媒体源并扫描后即可在此浏览。'
            }
        />
    );
}
