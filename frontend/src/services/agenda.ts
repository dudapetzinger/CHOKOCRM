/**
 * Acesso tipado à API da agenda do dia (UC09, Etapa 4). Espelha o shape de
 * `backend`'s `GET /agenda/today`: o representante vê só a própria carteira,
 * o gestor vê todos os clientes.
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
};

export type Agenda = {
  atrasadas: AgendaItem[];
  hoje: AgendaItem[];
};

type AgendaResponse = { data: Agenda };

export function buscarAgendaDoDia(): Promise<Agenda> {
  return api.get<AgendaResponse>('/agenda/today').then((resposta) => resposta.data);
}
