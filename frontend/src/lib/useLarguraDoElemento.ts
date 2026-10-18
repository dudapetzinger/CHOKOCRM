/**
 * Largura, em pixels, do elemento que recebe a `ref` (Etapa 8): os gráficos
 * em SVG do Painel desenham com `viewBox` igual à largura do cartão, para o
 * texto dos eixos ficar no tamanho certo em qualquer tela (um `viewBox` fixo
 * encolheria as letras no celular). Sem `ResizeObserver` (jsdom nos testes)
 * ou antes da primeira medida, vale `padrao`.
 */
import { useLayoutEffect, useRef, useState } from 'react';

export function useLarguraDoElemento<T extends HTMLElement>(padrao: number) {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(padrao);

  useLayoutEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    function medir(medida: number) {
      const arredondada = Math.round(medida);
      if (arredondada > 0) setLargura(arredondada);
    }

    medir(elemento.getBoundingClientRect().width);
    if (typeof ResizeObserver !== 'function') return;

    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) medir(entrada.contentRect.width);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return [ref, largura] as const;
}
