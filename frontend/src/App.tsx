import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RepresentanteProvider } from './representante/RepresentanteContext';
import { LoginPage } from './pages/LoginPage';
import { ClientesPage } from './pages/ClientesPage';
import { NovoClientePage } from './pages/NovoClientePage';
import { ClienteDetalhePage } from './pages/ClienteDetalhePage';
import { CheckInPage } from './pages/CheckInPage';
import { AgendaPage } from './pages/AgendaPage';
import { LimiteDeErroDeCarregamento } from './components/LimiteDeErroDeCarregamento';
import { useLarguraDesktop } from './lib/useLarguraDesktop';
import { AvisoNovaVersao } from './pwa/AvisoNovaVersao';
import { AvisoSemRede } from './pwa/AvisoSemRede';
import { BannerInstalar } from './pwa/BannerInstalar';

// O Painel (só do gestor) carrega o Recharts: fica num pedaço à parte, baixado só quando aberto.
const PainelPage = lazy(() => import('./pages/PainelPage'));

/**
 * `/clientes` e `/clientes/:id` numa rota só (Etapa 7). No desktop as duas
 * mostram a lista com a ficha ao lado — a mesma rota mantém a lista montada
 * (busca, aba, rolagem) ao trocar de cliente. No celular, com id, só a ficha.
 */
function ClientesOuFicha() {
  const { id } = useParams<{ id?: string }>();
  const desktop = useLarguraDesktop();
  return id && !desktop ? <ClienteDetalhePage /> : <ClientesPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RepresentanteProvider>
          {/* PWA (ADR-012): faixas de sem internet e de versão nova, acima da
              barra superior; abaixo, o convite para instalar (só com usuário logado). */}
          <div className="avisos-app">
            <AvisoSemRede />
            <AvisoNovaVersao />
          </div>
          <BannerInstalar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/clientes/:id?"
              element={
                <RequireAuth>
                  <ClientesOuFicha />
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
                  <LimiteDeErroDeCarregamento>
                    <Suspense
                      fallback={
                        <div className="container">
                          <div className="conteudo">
                            <p className="aviso">Carregando painel...</p>
                          </div>
                        </div>
                      }
                    >
                      <PainelPage />
                    </Suspense>
                  </LimiteDeErroDeCarregamento>
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
