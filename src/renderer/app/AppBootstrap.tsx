import { AppErrorBoundary } from './AppErrorBoundary';
import { ThemeProvider } from '../theme/ThemeProvider';
import { PrivacyStateProvider } from './PrivacyStateProvider';
import { AppRouter } from './AppRouter';

export function AppBootstrap() {
    return (
        <AppErrorBoundary>
            <ThemeProvider>
                <PrivacyStateProvider>
                    <AppRouter />
                </PrivacyStateProvider>
            </ThemeProvider>
        </AppErrorBoundary>
    );
}
