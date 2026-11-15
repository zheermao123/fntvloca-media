/**
 * 目录排序的规范化字符串比较。
 *
 * SQLite BINARY 排序按 UTF-8 字节序，而 UTF-8 字节序与 Unicode 码点序一致；
 * 这里按码点比较，保证 SQLite、JSONStore 与最终目录合并使用同一规则。
 */
export function compareCodePoints(a: string, b: string): number {
    if (a === b) {
        return 0;
    }
    const left = a[Symbol.iterator]();
    const right = b[Symbol.iterator]();
    for (;;) {
        const leftNext = left.next();
        const rightNext = right.next();
        if (leftNext.done && rightNext.done) {
            return 0;
        }
        if (leftNext.done) {
            return -1;
        }
        if (rightNext.done) {
            return 1;
        }
        const leftCode = leftNext.value.codePointAt(0) ?? 0;
        const rightCode = rightNext.value.codePointAt(0) ?? 0;
        if (leftCode !== rightCode) {
            return leftCode < rightCode ? -1 : 1;
        }
    }
}
