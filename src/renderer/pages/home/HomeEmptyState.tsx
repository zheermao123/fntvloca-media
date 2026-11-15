import { EmptyState } from '../../components/ui/EmptyState';
import { FilmIcon } from '../../components/icons';

export function HomeEmptyState() {
    return (
        <EmptyState
            icon={<FilmIcon size={26} />}
            title="媒体库为空"
            description="当前没有可展示的公开媒体内容。添加媒体源与扫描请在经典界面完成，媒体源管理页面将在后续阶段接入。"
        />
    );
}
