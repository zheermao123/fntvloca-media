import { EmptyState } from '../../components/ui/EmptyState';
import { FilmIcon } from '../../components/icons';

export function HomeEmptyState() {
    return (
        <EmptyState
            icon={<FilmIcon size={26} />}
            title="媒体库为空"
            description="当前没有可展示的公开媒体内容。在左侧「媒体源」中添加本地文件夹或 WebDAV 源并扫描即可。"
        />
    );
}
