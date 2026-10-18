import '@testing-library/jest-dom/vitest'

/**
 * O que o jsdom não implementa e o Radix (menus e popovers do shadcn, Etapa 8)
 * chama ao abrir: medir o conteúdo, capturar o ponteiro e rolar até o item.
 */
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = ResizeObserverFalso as unknown as typeof ResizeObserver
}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

/**
 * `matchMedia` que nunca corresponde: tela de celular, o mesmo que o app
 * assume sem `matchMedia`. Reposto antes de cada teste porque
 * `removerSimulacaoDeLargura` (test/simularLargura.ts) apaga a propriedade;
 * quem precisa de outra largura usa `simularLargura`.
 */
function matchMediaQueNuncaCorresponde(consulta: string): MediaQueryList {
  return {
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
}

beforeEach(() => {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaQueNuncaCorresponde,
    })
  }
})
