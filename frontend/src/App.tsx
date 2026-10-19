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
import { CampanhasPage } from './pages/CampanhasPage';
import { UsuariosPage } from './pages/UsuariosPage';
import { NovoUsuarioPage } from './pages/NovoUsuarioPage';
import { AlterarSenhaPage } from './pages/AlterarSenhaPage';
import { RedefinirSenhaPage } from './pages/RedefinirSenhaPage';
import { LimiteDeErroDeCarregamento } from './components/LimiteDeErroDeCarregamento';
import { rotaInicialDoPapel } from './lib/rotaInicial';
import { useLarguraDuasColunas } from './lib/useLarguraDesktop';
import { AvisoNovaVersao } from './pwa/AvisoNovaVersao';
import { AvisoSemRede } from './pwa/AvisoSemRede';
import { BannerInstalar } from './pwa/BannerInstalar';

// O Painel (gestor e representante) fica num pedaço à parte, baixado só quando aberto.
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
          {/* PWA (ADR-012): faixas de sem internet e de versão nova, no fluxo
              acima da barra superior (não grudam no topo, para nunca cobrir o
              "Voltar" e o menu da conta); abaixo, o convite para instalar (só
              com usuário logado), que rola com a página. */}
          <AvisoSemRede />
          <AvisoNovaVersao />
          <BannerInstalar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Pública e sem moldura: aberta pelo link do e-mail, com o token
                no fragmento (#…), que a página lê e tira do endereço */}
            <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
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
              <Route path="/campanhas" element={<CampanhasPage />} />
              <Route
                path="/painel"
                element={
                  <LimiteDeErroDeCarregamento>
                    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando painel...</p>}>
                      <PainelPage />
                    </Suspense>
                  </LimiteDeErroDeCarregamento>
                }
              />
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/usuarios/novo" element={<NovoUsuarioPage />} />
              <Route path="/conta/senha" element={<AlterarSenhaPage />} />
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
