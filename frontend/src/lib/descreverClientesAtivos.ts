/** "1 cliente ativo", "12 clientes ativos": usado no período dos indicadores e na distribuição por cor do Painel. */
export function descreverClientesAtivos(total: number): string {
  return `${total} ${total === 1 ? 'cliente ativo' : 'clientes ativos'}`;
}
