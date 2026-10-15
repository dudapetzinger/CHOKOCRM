import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RepresentanteProvider } from './representante/RepresentanteContext';
import { LoginPage } from './pages/LoginPage';
import { ClientesPage } from './pages/ClientesPage';
import { NovoClientePage } from './pages/NovoClientePage';
import { ClienteDetalhePage } from './pages/ClienteDetalhePage';
import { CheckInPage } from './pages/CheckInPage';
import { AgendaPage } from './pages/AgendaPage';

// O Painel (só do gestor) carrega o Recharts: fica num pedaço à parte, baixado só quando aberto.
const PainelPage = lazy(() => import('./pages/PainelPage'));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RepresentanteProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/clientes"
              element={
                <RequireAuth>
                  <ClientesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes/novo"
              element={
                <RequireAuth>
                  <NovoClientePage />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes/:id"
              element={
                <RequireAuth>
                  <ClienteDetalhePage />
                </RequireAuth>
              }
            />
            <Route
              path="/clientes/:id/check-in"
              element={
                <RequireAuth>
                  <CheckInPage />
                </RequireAuth>
              }
            />
            <Route
              path="/agenda"
              element={
                <RequireAuth>
                  <AgendaPage />
                </RequireAuth>
              }
            />
            <Route
              path="/painel"
              element={
                <RequireAuth>
                  <Suspense fallback={<p className="aviso">Carregando painel...</p>}>
                    <PainelPage />
                  </Suspense>
                </RequireAuth>
              }
            />
            <Route path="/" element={<Navigate to="/clientes" replace />} />
            <Route path="*" element={<Navigate to="/clientes" replace />} />
          </Routes>
        </RepresentanteProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
