/**
 * Estado do painel lateral de um bloco: o que foi escolhido (`null`:
 * fechado) e o gatilho que o abriu. `abrir(dados, gatilho)` é o
 * `aoEscolher` do `GatilhoDoBalao` (ou o clique de um botão); `fechar()`
 * fecha e devolve o foco ao gatilho, se ele ainda está na página.
 */
import { useCallback, useRef, useState } from 'react';

export function usePainelLateral<T>() {
  const [escolhido, setEscolhido] = useState<T | null>(null);
  const gatilho = useRef<Element | null>(null);

  const abrir = useCallback((dados: T, elemento: Element) => {
    gatilho.current = elemento;
    setEscolhido(dados);
  }, []);

  const fechar = useCallback(() => {
    setEscolhido(null);
    const elemento = gatilho.current;
    gatilho.current = null;
    if ((elemento instanceof HTMLElement || elemento instanceof SVGElement) && elemento.isConnected) elemento.focus();
  }, []);

  return { escolhido, abrir, fechar };
}
