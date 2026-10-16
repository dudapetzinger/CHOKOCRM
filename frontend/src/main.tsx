import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Fontes servidas pelo próprio app (sem CDN): Fraunces nos títulos (600 e 700;
// os títulos nunca usam 400), Manrope no texto
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import './styles/global.css';
// Depois de global.css: as regras de ≥ 768 px precisam vir por último na cascata
import './styles/desktop.css';
import App from './App.tsx';

const RECARREGOU_POR_ARQUIVO_VELHO = 'chokocrm:recarregou-por-arquivo-velho';

/**
 * Depois de um deploy, uma aba aberta antes dele pode pedir um pedaço lazy
 * (o Painel) que já não existe; o Vite avisa com `vite:preloadError`.
 * Recarregar baixa a versão nova. Só uma vez por sessão, para não entrar em
 * laço se o problema for outro; daí em diante, o limite de erro em volta do
 * Painel (App.tsx) mostra o aviso com o botão "Recarregar".
 */
window.addEventListener('vite:preloadError', (evento) => {
  try {
    if (sessionStorage.getItem(RECARREGOU_POR_ARQUIVO_VELHO)) return;
    sessionStorage.setItem(RECARREGOU_POR_ARQUIVO_VELHO, '1');
  } catch {
    // Sem armazenamento (modo privado, bloqueio): sem guarda, então sem recarregar sozinho.
    return;
  }
  evento.preventDefault();
  window.location.reload();
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
