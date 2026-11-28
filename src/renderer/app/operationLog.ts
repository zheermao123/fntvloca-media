import { useSyncExternalStore } from 'react';

export type OperationKind =
    | 'scan'
    | 'scrape'
    | 'sourceScan'
    | 'itemScrape'
    | 'match'
    | 'sourceAdd'
    | 'sourceRemove';

export type OperationStatus = 'running' | 'success' | 'error';

export type OperationRecord = {
    id: string;
    kind: OperationKind;
    title: string;
    target: string | null;
    private: boolean;
    status: OperationStatus;
    summary: string;
    startedAt: number;
    finishedAt: number | null;
    /** 由后端运行状态恢复而来，不代表本 renderer 实际发起。 */
    recovered?: boolean;
};

const MAX_OPERATIONS = 100;
const listeners = new Set<() => void>();
let sequence = 0;
let operations: OperationRecord[] = [];

function emit(): void {
    for (const listener of listeners) {
        listener();
    }
}

export function startOperation(input: {
    kind: OperationKind;
    title: string;
    target?: string | null;
    private?: boolean;
    summary?: string;
    recovered?: boolean;
}): string {
    const record: OperationRecord = {
        id: `op-${Date.now()}-${++sequence}`,
        kind: input.kind,
        title: input.title,
        target: input.target ?? null,
        private: input.private === true,
        status: 'running',
        summary: input.summary ?? '进行中…',
        startedAt: Date.now(),
        finishedAt: null,
        recovered: input.recovered,
    };
    operations = [record, ...operations].slice(0, MAX_OPERATIONS);
    emit();
    return record.id;
}

export function finishOperation(id: string, status: Exclude<OperationStatus, 'running'>, summary: string): void {
    let changed = false;
    operations = operations.map((record) => {
        if (record.id !== id || record.status !== 'running') {
            return record;
        }
        changed = true;
        return {
            ...record,
            status,
            summary: summary.trim() || (status === 'success' ? '已完成' : '操作失败'),
            finishedAt: Date.now(),
        };
    });
    if (changed) {
        emit();
    }
}

export function getOperations(): OperationRecord[] {
    return operations;
}

export function findRunningOperation(kind: OperationKind): OperationRecord | undefined {
    return operations.find((record) => record.kind === kind && record.status === 'running');
}

export function subscribeOperations(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useOperationLog(): OperationRecord[] {
    return useSyncExternalStore(subscribeOperations, getOperations, getOperations);
}

/** 仅用于单元测试，清空本次软件运行期的操作记录。 */
export function resetOperationsForTests(): void {
    operations = [];
    sequence = 0;
    emit();
}

