import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { useAuth } from './lib/auth';
import { BrandMark } from './components/Logo';
import HomePage from './pages/Home';
import ChatPage from './pages/Chat';
import { ProvidersPage, ProviderDetailPage } from './pages/Providers';
import ModelsPage from './pages/Models';
import ImageStudioPage from './pages/ImageStudio';
import LibraryPage from './pages/Library';
import ProjectsPage from './pages/Projects';
import IntegrationsPage from './pages/Integrations';
import SettingsPage from './pages/Settings';
import AuthPage from './pages/Auth';
import LegalPage from './pages/Legal';
import NotFound from './pages/NotFound';

/**
 * Auth gate: when Firebase is configured, private routes require a real
 * session. When it is not configured the app still runs in the clearly
 * labelled "local only" mode — never with fake accounts.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { configured, user, loading } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <BrandMark size={44} />
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-[var(--accent)]" />
      </div>
    );

  if (configured && !user) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { configured, user, loading } = useAuth();
  if (!loading && configured && user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* public: auth */}
      <Route
        path="/auth"
        element={
          <RedirectIfAuthed>
            <AuthPage mode="signin" />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/auth/signup"
        element={
          <RedirectIfAuthed>
            <AuthPage mode="signup" />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/auth/reset"
        element={
          <RedirectIfAuthed>
            <AuthPage mode="reset" />
          </RedirectIfAuthed>
        }
      />

      {/* public: legal */}
      <Route path="/privacy" element={<LegalPage page="privacy" />} />
      <Route path="/terms" element={<LegalPage page="terms" />} />
      <Route path="/cookies" element={<LegalPage page="cookies" />} />

      {/* application shell */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/providers/:id" element={<ProviderDetailPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/studio" element={<ImageStudioPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
