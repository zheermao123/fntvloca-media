import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
    size?: number;
};

function baseProps(size: number): SVGProps<SVGSVGElement> {
    return {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
    };
}

export function PlayIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function StarIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="m12 4 2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 15.98l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L12 4Z" />
        </svg>
    );
}

export function SearchIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
        </svg>
    );
}

export function CloseIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="M6 6l12 12M18 6 6 18" />
        </svg>
    );
}

export function ChevronDownIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}

export function ChevronLeftIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="m15 6-6 6 6 6" />
        </svg>
    );
}

export function FolderIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-10Z" />
        </svg>
    );
}

export function SettingsIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.8v2.4M12 18.8v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
        </svg>
    );
}

export function ScanIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" />
        </svg>
    );
}

export function SparklesIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.5l-1.6-4.3L6 10.6 10.4 9 12 4.5Z" />
            <path d="M18.5 15.5 19.3 18l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8.8-2.5Z" />
        </svg>
    );
}

export function FilmIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <rect x="3.5" y="5" width="17" height="14" rx="2" />
            <path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4" />
        </svg>
    );
}

export function MoreHorizontalIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function CheckIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="m5 12.5 4.5 4.5L19 7" />
        </svg>
    );
}

export function HomeIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="m4 11 8-6.5L20 11" />
            <path d="M6.5 9.8V19h11V9.8" />
            <path d="M10 19v-5h4v5" />
        </svg>
    );
}

export function TvIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
            <path d="m8 3.5 4 3 4-3" />
        </svg>
    );
}

export function LockIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
    );
}

export function GridIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <rect x="4" y="4" width="7" height="7" rx="1.5" />
            <rect x="13" y="4" width="7" height="7" rx="1.5" />
            <rect x="4" y="13" width="7" height="7" rx="1.5" />
            <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
    );
}

export function ListIcon({ size = 16, ...rest }: IconProps) {
    return (
        <svg {...baseProps(size)} {...rest}>
            <path d="M8 6h12M8 12h12M8 18h12" />
            <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}
