/**
 * `window.matchMedia` falso para os testes (o jsdom não implementa).
 *
 * - `simularLargura(true)`: toda consulta de mídia corresponde (desktop largo);
 *   `false`: nenhuma corresponde (celular).
 * - `simularLargura(900)`: uma largura em pixels; `(min-width: Npx)`
 *   corresponde quando N ≤ 900, e consultas de outro tipo não correspondem.
 *
 * `mudar()` troca o valor e avisa os ouvintes do evento `change`, como ao
 * redimensionar.
 */
type Ouvinte = () => void;
type Largura = boolean | number;

function corresponde(largura: Largura, consulta: string): boolean {
  if (typeof largura === 'boolean') {
    return largura;
  }
  const minimo = /\(min-width:\s*(\d+)px\)/.exec(consulta);
  return minimo !== null && largura >= Number(minimo[1]);
}

export function simularLargura(inicial: Largura) {
  let largura = inicial;
  const ouvintes = new Set<Ouvinte>();

  const matchMedia = vi.fn((consulta: string) => ({
    get matches() {
      return corresponde(largura, consulta);
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
    mudar(nova: Largura) {
      largura = nova;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}

/** Volta ao padrão do jsdom: sem `matchMedia` (o app trata como celular). */
export function removerSimulacaoDeLargura() {
  Reflect.deleteProperty(window, 'matchMedia');
}
