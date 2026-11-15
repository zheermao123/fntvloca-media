/** 任务页映射：刮削状态摘要与进度百分比（纯函数） */
export type ScrapeSummaryDto = {
    scraped: number;
    failed: number;
    skipped: number;
    firstError?: string;
};

export type ScrapeProgressDto = {
    done: number;
    total: number;
    title: string;
};

export function describeScrapeSummary(summary: ScrapeSummaryDto | null): string | null {
    if (!summary) {
        return null;
    }
    const base = `上次刮削：成功 ${summary.scraped}，失败 ${summary.failed}，跳过 ${summary.skipped}`;
    return summary.firstError ? `${base}（首个错误：${summary.firstError}）` : base;
}

export function scrapePercent(progress: ScrapeProgressDto): number {
    if (progress.total <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round((progress.done / progress.total) * 100)));
}

export type SessionTaskKind = 'scan' | 'scrape';
export type SessionTaskStatus = 'running' | 'success' | 'error';

export type SessionTask = {
    id: string;
    kind: SessionTaskKind;
    startedAt: number;
    finishedAt: number | null;
    status: SessionTaskStatus;
    summary: string;
};

export function addSessionTask(tasks: SessionTask[], task: SessionTask, max = 20): SessionTask[] {
    return [task, ...tasks].slice(0, max);
}

export function finishSessionTask(
    tasks: SessionTask[],
    id: string,
    status: Exclude<SessionTaskStatus, 'running'>,
    summary: string,
    finishedAt: number = Date.now()
): SessionTask[] {
    return tasks.map((task) =>
        task.id === id ? { ...task, status, summary, finishedAt } : task
    );
}

export function taskKindLabel(kind: SessionTaskKind): string {
    return kind === 'scan' ? '媒体库扫描' : 'TMDB 刮削';
}

export function taskStatusLabel(status: SessionTaskStatus): string {
    if (status === 'running') {
        return '进行中';
    }
    return status === 'success' ? '已完成' : '失败';
}

export function formatTaskTime(timestamp: number): string {
    const date = new Date(timestamp);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}