/**
 * Largura de desktop (Etapa 7): a partir de 768 px o app troca a navegação
 * inferior pela lateral e mostra Clientes, Agenda e Painel em duas colunas
 * (ver styles/desktop.css, que usa o mesmo valor no `@media`). Sem
 * `window.matchMedia` (jsdom nos testes, navegadores muito antigos), vale o
 * layout de celular.
 */
import { useSyncExternalStore } from 'react';

export const LARGURA_DESKTOP_MIN = 768;

const CONSULTA = `(min-width: ${LARGURA_DESKTOP_MIN}px)`;

function consultarMidia(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(CONSULTA);
}

function assinar(aoMudar: () => void): () => void {
  const midia = consultarMidia();
  if (!midia) {
    return () => {};
  }
  midia.addEventListener('change', aoMudar);
  return () => midia.removeEventListener('change', aoMudar);
}

function ehDesktop(): boolean {
  return consultarMidia()?.matches ?? false;
}

export function useLarguraDesktop(): boolean {
  return useSyncExternalStore(assinar, ehDesktop, () => false);
}
