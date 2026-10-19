/**
 * Acesso tipado à API de visitas do ChokoCRM (UC07/UC08).
 *
 * Espelha o `VisitaDTO` de `backend/src/services/visit.service.ts`. A foto
 * vai numa chamada separada do check-in, de propósito: a visita fica
 * salva antes do upload da parte pesada, e uma falha de rede no envio da
 * imagem não perde o registro.
 */
import { api } from './api';

export type ResultadoVisita = 'VENDA' | 'NEGOCIACAO' | 'SEM_VENDA';

export const ROTULO_RESULTADO: Record<ResultadoVisita, string> = {
  VENDA: 'Houve venda',
  NEGOCIACAO: 'Em negociação',
  SEM_VENDA: 'Sem venda',
};

/** Item gravado no pedido da visita: nome e preço do catálogo no dia do check-in. */
export type ItemPedidoVisita = {
  sku: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
};

export type Visita = {
  id: string;
  dataHora: string;
  descricao: string;
  resultado: ResultadoVisita;
  contato: { id: string; nome: string } | null;
  autor: { id: string; nome: string };
  temFoto: boolean;
  criadoEm: string;
  editadoEm: string | null;
  /** Vazio quando a visita não tem pedido. */
  itens: ItemPedidoVisita[];
  /** Calculado no backend, em reais. */
  totalPedido: number;
};

/** Linha do pedido no check-in: só produto e quantidade (o preço vem do catálogo, no backend). */
export type ItemPedido = { sku: string; quantidade: number };

export type CheckInInput = {
  descricao: string;
  resultado: ResultadoVisita;
  dataHora?: string;
  contactId?: string;
  /** Só com resultado VENDA, e sem linhas de quantidade 0. */
  itens?: ItemPedido[];
  /**
   * Próxima visita prevista (`AAAA-MM-DD`, hoje ou depois), gravada no
   * cliente: a visita nova substitui a data marcada antes. `null` (ou
   * ausente) apaga a data e o lembrete e a agenda volta à recorrência.
   */
  proximaVisita?: string | null;
  /** Até 200 caracteres; só vale com data. `null` (ou ausente) apaga o lembrete. */
  lembrete?: string | null;
};

export async function listarVisitas(clienteId: string): Promise<Visita[]> {
  const resposta = await api.get<{ data: Visita[] }>(`/clients/${clienteId}/visits`);
  return resposta.data;
}

export function registrarCheckIn(clienteId: string, input: CheckInInput): Promise<Visita> {
  return api.post<Visita>(`/clients/${clienteId}/visits`, input);
}

export function editarDescricao(visitaId: string, descricao: string): Promise<Visita> {
  return api.patch<Visita>(`/visits/${visitaId}`, { descricao });
}

export function enviarFoto(visitaId: string, foto: Blob): Promise<void> {
  return api.putBinario(`/visits/${visitaId}/foto`, foto);
}

export function buscarFoto(visitaId: string): Promise<Blob> {
  return api.getBlob(`/visits/${visitaId}/foto`);
}
