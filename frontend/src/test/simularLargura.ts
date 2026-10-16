/**
 * `window.matchMedia` falso para os testes (o jsdom não implementa). Com
 * `desktop: true`, toda consulta de mídia corresponde; `mudar()` troca o
 * resultado e avisa os ouvintes do evento `change`, como ao redimensionar.
 */
type Ouvinte = () => void;

export function simularLargura(desktop: boolean) {
  let corresponde = desktop;
  const ouvintes = new Set<Ouvinte>();

  const matchMedia = vi.fn((consulta: string) => ({
    get matches() {
      return corresponde;
    },
    media: consulta,
    onchange: null,
    addEventListener: (_tipo: string, ouvinte: Ouvinte) => ouvintes.add(ouvinte),
    removeEventListener: (_tipo: string, ouvinte: Ouvinte) => ouvintes.delete(ouvinte),
    addListener: (ouvinte: Ouvinte) => ouvintes.add(ouvinte),
    removeListener: (ouvinte: Ouvinte) => ouvintes.delete(ouvinte),
    dispatchEvent: () => true,
  }));

  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });

  return {
    matchMedia,
    mudar(novo: boolean) {
      corresponde = novo;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}

/** Volta ao padrão do jsdom: sem `matchMedia` (o app trata como celular). */
export function removerSimulacaoDeLargura() {
  Reflect.deleteProperty(window, 'matchMedia');
}
