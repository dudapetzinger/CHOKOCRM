import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'
import { toast } from 'sonner'

/**
 * `findBy*` e `waitFor` esperam até 5 s em vez de 1 s: com a cobertura ligada
 * (como no CI), o jsdom fica bem mais lento, e o calendário (42 dias, cada um
 * um botão) passava de 1 s para aparecer quando a suíte inteira rodava junto —
 * o mesmo motivo do `testTimeout` de 15 s em vitest.config.ts.
 */
configure({ asyncUtilTimeout: 5000 })

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

/**
 * Os avisos do sonner ficam num estado do módulo, e um `Toaster` novo
 * recebe de novo os que ainda estão ativos: sem isto, o "Check-in salvo" de
 * um teste aparece no seguinte.
 */
afterEach(() => {
  toast.dismiss()
})
