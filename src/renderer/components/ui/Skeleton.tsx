export interface SkeletonProps {
    variant?: 'text' | 'rect' | 'circle';
    className?: string;
}

export function Skeleton({ variant = 'rect', className }: SkeletonProps) {
    return <span className={['ui-skeleton', `ui-skeleton--${variant}`, className ?? ''].filter(Boolean).join(' ')} aria-hidden="true" />;
}
