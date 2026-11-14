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
