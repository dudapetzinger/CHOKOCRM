import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Fonte servida pelo próprio app (sem CDN, o PWA abre sem rede): Plus
// Jakarta Sans, a do protótipo (Etapa 8), nos pesos que as telas usam
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
// Tailwind e os tokens do protótipo: o único arquivo de estilo (ver o cabeçalho dele)
import './styles.css';
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
