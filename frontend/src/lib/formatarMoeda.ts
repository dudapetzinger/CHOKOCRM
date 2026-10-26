/** Formata um valor numérico como moeda pt-BR (R$); usado nas fichas de cliente. */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
