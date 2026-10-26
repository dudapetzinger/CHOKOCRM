import { contar } from './contar';

/** "1 cliente ativo", "12 clientes ativos": usado no período dos indicadores e na distribuição por cor do Painel. */
export function descreverClientesAtivos(total: number): string {
  return contar(total, 'cliente ativo', 'clientes ativos');
}

/** "0 clientes", "1 cliente", "5 clientes": a carteira na tela de Usuários e os avisos de transferência. */
export function descreverClientes(total: number): string {
  return contar(total, 'cliente');
}
