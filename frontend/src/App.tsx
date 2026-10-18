import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { useAuth } from './auth/useAuth';
import { RepresentanteProvider } from './representante/RepresentanteContext';
import { Moldura } from './components/crm/Moldura';
import { Toaster } from './components/ui/sonner';
import { LoginPage } from './pages/LoginPage';
import { ClientesPage } from './pages/ClientesPage';
import { NovoClientePage } from './pages/NovoClientePage';
import { ClienteDetalhePage } from './pages/ClienteDetalhePage';
import { CheckInPage } from './pages/CheckInPage';
import { AgendaPage } from './pages/AgendaPage';
import { LimiteDeErroDeCarregamento } from './components/LimiteDeErroDeCarregamento';
import { rotaInicialDoPapel } from './lib/rotaInicial';
import { useLarguraDuasColunas } from './lib/useLarguraDesktop';
import { AvisoNovaVersao } from './pwa/AvisoNovaVersao';
import { AvisoSemRede } from './pwa/AvisoSemRede';
import { BannerInstalar } from './pwa/BannerInstalar';

// O Painel (só do gestor) carrega o Recharts: fica num pedaço à parte, baixado só quando aberto.
const PainelPage = lazy(() => import('./pages/PainelPage'));

/**
 * `/clientes` e `/clientes/:id` numa rota só (Etapa 7). A partir de 1024 px
 * (spec 7.1) as duas mostram a lista com a ficha ao lado — a mesma rota
 * mantém a lista montada (busca, aba, rolagem) ao trocar de cliente. Abaixo
 * disso (celular e tablet), com id, só a ficha.
 */
function ClientesOuFicha() {
  const { id } = useParams<{ id?: string }>();
  const duasColunas = useLarguraDuasColunas();
  return id && !duasColunas ? <ClienteDetalhePage /> : <ClientesPage />;
}

/** `/` e endereços desconhecidos levam à tela inicial do papel (spec 6.5). */
function TelaInicial() {
  const { user } = useAuth();
  return user ? <Navigate to={rotaInicialDoPapel(user.role)} replace /> : null;
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
            {/* Telas autenticadas dentro da moldura (menu, barra superior e navegação) */}
            <Route
              element={
                <RequireAuth>
                  <Moldura />
                </RequireAuth>
              }
            >
              <Route path="/" element={<TelaInicial />} />
              <Route path="/clientes/:id?" element={<ClientesOuFicha />} />
              <Route path="/clientes/novo" element={<NovoClientePage />} />
              <Route path="/clientes/:id/check-in" element={<CheckInPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route
                path="/painel"
                element={
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
                }
              />
              <Route path="*" element={<TelaInicial />} />
            </Route>
          </Routes>
          <Toaster />
        </RepresentanteProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
