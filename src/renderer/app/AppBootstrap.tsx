import { AppErrorBoundary } from './AppErrorBoundary';
import { ThemeProvider } from '../theme/ThemeProvider';
import { ToastProvider } from '../components/ui/ToastProvider';
import { PrivacyStateProvider } from './PrivacyStateProvider';
import { AppRouter } from './AppRouter';

export function AppBootstrap() {
    return (
        <AppErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <PrivacyStateProvider>
                        <AppRouter />
                    </PrivacyStateProvider>
                </ToastProvider>
            </ThemeProvider>
        </AppErrorBoundary>
    );
}
