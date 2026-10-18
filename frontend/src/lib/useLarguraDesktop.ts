/**
 * Larguras de tela que mudam o layout (Etapa 7; duas larguras na Etapa 8).
 *
 * - `useLarguraDesktop` (≥ 768 px, o `md` do Tailwind): a moldura troca a
 *   navegação inferior pelo menu lateral; Agenda e Painel ficam em duas
 *   colunas; em Clientes, "Novo cliente" sai do botão flutuante para a barra
 *   de ferramentas.
 * - `useLarguraDuasColunas` (≥ 1024 px, o `lg`): Clientes mostra a lista com
 *   a ficha ao lado (spec 7.1). Abaixo disso, com o menu lateral de 240 px,
 *   as duas não cabem: lista e ficha ficam em telas separadas.
 *
 * Sem `window.matchMedia` (jsdom nos testes, navegadores muito antigos), vale
 * o layout de celular.
 */
import { useSyncExternalStore } from 'react';

export const LARGURA_DESKTOP_MIN = 768;
export const LARGURA_DUAS_COLUNAS_MIN = 1024;

type ConsultaDeLargura = {
  assinar: (aoMudar: () => void) => () => void;
  corresponde: () => boolean;
};

/** Assinatura e leitura de `(min-width: {minimo}px)`, estáveis para o `useSyncExternalStore`. */
function criarConsulta(minimo: number): ConsultaDeLargura {
  const consulta = `(min-width: ${minimo}px)`;

  function consultarMidia(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return null;
    }
    return window.matchMedia(consulta);
  }

  return {
    assinar(aoMudar) {
      const midia = consultarMidia();
      if (!midia) {
        return () => {};
      }
      midia.addEventListener('change', aoMudar);
      return () => midia.removeEventListener('change', aoMudar);
    },
    corresponde() {
      return consultarMidia()?.matches ?? false;
    },
  };
}

const DESKTOP = criarConsulta(LARGURA_DESKTOP_MIN);
const DUAS_COLUNAS = criarConsulta(LARGURA_DUAS_COLUNAS_MIN);

function semJanela(): boolean {
  return false;
}

export function useLarguraDesktop(): boolean {
  return useSyncExternalStore(DESKTOP.assinar, DESKTOP.corresponde, semJanela);
}

export function useLarguraDuasColunas(): boolean {
  return useSyncExternalStore(DUAS_COLUNAS.assinar, DUAS_COLUNAS.corresponde, semJanela);
}
