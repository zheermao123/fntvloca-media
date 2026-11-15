import type { ReactNode } from 'react';

export function MainRegion({ children }: { children: ReactNode }) {
    return <main className="app-main">{children}</main>;
}
