import type { ReactNode } from 'react';

/**
 * 窗口框架：
 * - 复用 preload 注入的 #custom-titlebar（顶部 32px 拖拽区 + Win/Linux 自绘窗控，macOS 原生交通灯）；
 * - 不创建第二套标题栏/窗控；
 * - 内容区域从标题栏下方开始，避免遮挡。
 */
export function WindowFrame({ children }: { children: ReactNode }) {
    return <div className="app-window">{children}</div>;
}
