/** Formata um valor numérico como moeda pt-BR (R$); usado nas fichas de cliente. */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/** Moeda pt-BR abreviada para eixos de gráfico: "R$ 12 mil", "R$ 1,2 mi". */
export function formatarMoedaCompacta(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(valor);
}
