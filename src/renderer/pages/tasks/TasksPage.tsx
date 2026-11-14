import { EmptyState } from '../../components/ui/EmptyState';
import { ScanIcon } from '../../components/icons';

export function TasksPage() {
    return (
        <section className="app-page">
            <EmptyState
                icon={<ScanIcon size={26} />}
                title="任务状态即将接入"
                description="扫描/刮削的进程内状态与最近结果摘要将在 P2-06 阶段接入；不新增任务持久化能力。"
            />
        </section>
    );
}
