import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ROUTES } from './routes';
import { HomePage } from '../pages/home/HomePage';
import { LibraryPage } from '../pages/library/LibraryPage';
import { MediaDetailPage } from '../pages/detail/MediaDetailPage';
import { SourcesPage } from '../pages/sources/SourcesPage';
import { TasksPage } from '../pages/tasks/TasksPage';

/** 使用 HashRouter：Electron file:// 加载不依赖服务器路由回退 */
export function AppRouter() {
    return (
        <HashRouter>
            <Routes>
                <Route element={<AppShell />}>
                    <Route index element={<Navigate to={ROUTES.home} replace />} />
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/library/:category" element={<LibraryPage />} />
                    <Route path="/media/:id" element={<MediaDetailPage />} />
                    <Route path="/sources" element={<SourcesPage />} />
                    <Route path="/tasks" element={<TasksPage />} />
                    <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
                </Route>
            </Routes>
        </HashRouter>
    );
}
