/**
 * 单飞（single-flight）守卫：用于主进程扫描等互斥任务。
 * 并发触发时第二个调用立即得到 started=false，任务异常也会释放。
 */
export type SingleFlightOutcome<T> = { started: true; value: T } | { started: false };

export function createSingleFlight() {
    let running = false;
    return {
        isRunning: () => running,
        async run<T>(task: () => Promise<T>): Promise<SingleFlightOutcome<T>> {
            if (running) {
                return { started: false };
            }
            running = true;
            try {
                return { started: true, value: await task() };
            } finally {
                running = false;
            }
        },
    };
}
