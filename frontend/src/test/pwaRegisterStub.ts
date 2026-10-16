/**
 * Substituto do módulo virtual `virtual:pwa-register/react` nos testes
 * (alias em vitest.config.ts): o módulo só existe com o vite-plugin-pwa
 * ligado, e no jsdom não há service worker. Testes que precisam de outro
 * comportamento usam `vi.mock('virtual:pwa-register/react', ...)`.
 */
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export function useRegisterSW(_opcoes?: RegisterSWOptions) {
  return {
    needRefresh: [false, () => {}] as const,
    offlineReady: [false, () => {}] as const,
    updateServiceWorker: async () => {},
  };
}
