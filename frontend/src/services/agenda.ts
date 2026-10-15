/**
 * Acesso tipado à API da agenda do dia (UC10, Etapa 4). Espelha o shape de
 * `backend`'s `GET /agenda/today`: o representante vê só a própria carteira,
 * o gestor vê todos os clientes ou só os de um representante
 * (`representanteId`, Etapa 7).
 */
import { api } from './api';
import type { Cor } from './clients';

export type AgendaItem = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  cor: Cor;
  diasSemVisita: number | null;
  proximaVisita: string;
  diasAtraso: number;
  rebaixadoPorVenda: boolean;
  representante: { id: string; nome: string };
};

export type Agenda = {
  atrasadas: AgendaItem[];
  hoje: AgendaItem[];
};

type AgendaResponse = { data: Agenda };

/** `representanteId` só faz efeito para o gestor; vai na query só quando definido. */
export function buscarAgendaDoDia(representanteId?: string): Promise<Agenda> {
  const qs = representanteId ? `?${new URLSearchParams({ representanteId })}` : '';
  return api.get<AgendaResponse>(`/agenda/today${qs}`).then((resposta) => resposta.data);
}
