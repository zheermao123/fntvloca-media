import type { ReactNode } from 'react';

export interface TooltipProps {
    content: string;
    children: ReactNode;
    className?: string;
}

/** 纯 CSS 提示（悬停/聚焦时展示），无运行时样式注入 */
export function Tooltip({ content, children, className }: TooltipProps) {
    return (
        <span className={['ui-tooltip', className ?? ''].filter(Boolean).join(' ')} data-tooltip={content}>
            {children}
        </span>
    );
}
