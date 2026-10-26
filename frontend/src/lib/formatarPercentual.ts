/** Espaço sem quebra: "70 %" nunca separa o número do sinal. */
const NBSP = ' ';

/**
 * Percentual inteiro como o app escreve em toda parte, "70 %" (número,
 * espaço sem quebra e o sinal, como na barra das metas): o mesmo texto nas
 * metas, na conversão por representante, nos indicadores e no ranking.
 */
export function formatarPercentual(percentual: number): string {
  return `${percentual}${NBSP}%`;
}
