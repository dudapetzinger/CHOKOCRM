/** Formata um valor numérico como moeda pt-BR (R$); usado nas fichas de cliente. */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/** Valor abreviado para eixos de gráfico, sem a moeda (que vai na legenda): "12 mil", "1,2 mi". */
export function formatarValorCompacto(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(valor);
}
