/**
 * Acesso tipado à API de visitas do ChokoCRM.
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

/** Item do pedido da visita, vindo da nota fiscal vinculada: produto, quantidade e preço. */
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
  /** Quando a limpeza dos 90 dias apagou a foto; `null` se a foto nunca foi removida. */
  fotoApagadaEm: string | null;
  criadoEm: string;
  editadoEm: string | null;
  /** Vazio quando a visita não tem pedido. */
  itens: ItemPedidoVisita[];
  /** Calculado no backend, em reais. */
  totalPedido: number;
  /** Campanha da visita; `null` sem campanha ou depois de a campanha ser excluída. */
  campanha: { id: string; nome: string } | null;
  /** Nota fiscal importada vinculada à visita; `null` sem vínculo. */
  notaFiscal: { numero: string; valorTotal: number } | null;
};

export type CheckInInput = {
  descricao: string;
  resultado: ResultadoVisita;
  dataHora?: string;
  contactId?: string;
  /**
   * Próxima visita prevista (`AAAA-MM-DD`, hoje ou depois), gravada no
   * cliente: a visita nova substitui a data marcada antes. `null` (ou
   * ausente) apaga a data (e a campanha da próxima visita) e a agenda volta
   * à recorrência; os lembretes não dependem dela.
   */
  proximaVisita?: string | null;
  /**
   * Lembrete com data própria: texto de 1 a 200 caracteres e `data`
   * (`AAAA-MM-DD`, hoje ou depois), independente da próxima visita. Ausente,
   * não cria lembrete; os já abertos ficam como estão.
   */
  lembrete?: { texto: string; data: string };
  /** Campanha da visita, não encerrada. */
  campanhaId?: string;
  /** Campanha da próxima visita: só vale com data; ausente apaga a anterior, como o lembrete. */
  proximaCampanhaId?: string;
};

export async function listarVisitas(clienteId: string): Promise<Visita[]> {
  const resposta = await api.get<{ data: Visita[] }>(`/clients/${clienteId}/visits`);
  return resposta.data;
}

export function registrarCheckIn(clienteId: string, input: CheckInInput): Promise<Visita> {
  return api.post<Visita>(`/clients/${clienteId}/visits`, input);
}

/**
 * Corrige a descrição e/ou o resultado (só o autor). Mudar de Venda para outro
 * resultado numa visita com pedido ou nota fiscal vinculada dá 409.
 */
export function editarVisita(
  visitaId: string,
  dados: { descricao?: string; resultado?: ResultadoVisita },
): Promise<Visita> {
  return api.patch<Visita>(`/visits/${visitaId}`, dados);
}

export function enviarFoto(visitaId: string, foto: Blob): Promise<void> {
  return api.putBinario(`/visits/${visitaId}/foto`, foto);
}

export function buscarFoto(visitaId: string): Promise<Blob> {
  return api.getBlob(`/visits/${visitaId}/foto`);
}
