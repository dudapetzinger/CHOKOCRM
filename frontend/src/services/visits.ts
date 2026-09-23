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
};

export type CheckInInput = {
  descricao: string;
  resultado: ResultadoVisita;
  dataHora?: string;
  contactId?: string;
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
