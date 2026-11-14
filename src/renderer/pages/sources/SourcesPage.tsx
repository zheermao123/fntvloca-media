import { EmptyState } from '../../components/ui/EmptyState';
import { FolderIcon } from '../../components/icons';

export function SourcesPage() {
    return (
        <section className="app-page">
            <EmptyState
                icon={<FolderIcon size={26} />}
                title="媒体源页面即将接入"
                description="媒体源列表与状态将在 P2-06 阶段接入现有接口；连接测试与编辑能力属于 Phase 4。"
            />
        </section>
    );
}
