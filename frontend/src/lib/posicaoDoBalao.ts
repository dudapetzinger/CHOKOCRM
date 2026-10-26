/**
 * Posição do balão dos gráficos (Etapa 9, spec do balão de hover): conta
 * pura, testada com retângulos literais; o componente (`BalaoDoGrafico`)
 * mede com `getBoundingClientRect()`. Devolve `x`/`y` relativos à área
 * (`relative`) onde o balão é desenhado: centralizado no gatilho, acima dele
 * quando cabe entre o topo da área e o gatilho, senão abaixo; `x` preso a
 * `[0, area.width - largura]` para o balão não sair da área.
 */
export type Retangulo = { left: number; top: number; width: number; height: number };

export function posicaoDoBalao(
  gatilho: Retangulo,
  area: Retangulo,
  balao: { largura: number; altura: number },
  margem = 8,
): { x: number; y: number; acima: boolean } {
  const esquerdaDoGatilho = gatilho.left - area.left;
  const topoDoGatilho = gatilho.top - area.top;

  const centralizado = esquerdaDoGatilho + gatilho.width / 2 - balao.largura / 2;
  const x = Math.max(0, Math.min(centralizado, area.width - balao.largura));

  const acima = topoDoGatilho >= balao.altura + margem;
  const y = acima ? topoDoGatilho - balao.altura - margem : topoDoGatilho + gatilho.height + margem;

  return { x, y, acima };
}
