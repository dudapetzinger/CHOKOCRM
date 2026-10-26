/**
 * Acesso tipado à API da agenda do dia (UC10, Etapa 4; com os lembretes
 * abertos até hoje desde a Etapa 9) e do calendário do mês (spec 7.6, Etapa
 * 8). Espelha o shape de `GET /agenda/today` e `GET
 * /agenda/calendario` do backend: o representante vê só a própria carteira,
 * o gestor vê todos os clientes ou só os de um representante
 * (`representanteId`, Etapa 7).
 */
import { api } from './api';
import type { Cor } from './clients';
import type { LembreteItem } from './lembretes';

export type AgendaItem = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  /** Rua e número do cliente. */
  endereco: string;
  cor: Cor;
  diasSemVisita: number | null;
  /** Data prevista (`AAAA-MM-DD`): a marcada no check-in ou a da recorrência. */
  proximaVisita: string;
  /** Positivo em atrasadas, 0 hoje, negativo nos próximos dias (-1 = amanhã). */
  diasAtraso: number;
  /** A data prevista veio do check-in (e não da recorrência). */
  marcadaNoCheckIn: boolean;
  /** Campanha da próxima visita (spec 7.7). */
  proximaCampanha: { id: string; nome: string } | null;
  rebaixadoPorVenda: boolean;
  representante: { id: string; nome: string };
};

export type Agenda = {
  atrasadas: AgendaItem[];
  hoje: AgendaItem[];
  /** Data prevista de amanhã a hoje + 7, em ordem de data e depois de cor. */
  proximos7Dias: AgendaItem[];
  /** Lembretes abertos com data até hoje (os vencidos e os de hoje), por data. */
  lembretes: LembreteItem[];
};

type AgendaResponse = { data: Agenda };

/** `representanteId` só faz efeito para o gestor; vai na query só quando definido. */
export function buscarAgendaDoDia(representanteId?: string): Promise<Agenda> {
  const qs = representanteId ? `?${new URLSearchParams({ representanteId })}` : '';
  return api.get<AgendaResponse>(`/agenda/today${qs}`).then((resposta) => resposta.data);
}

/**
 * Um item num dia do calendário (spec 7.6), como `ItemCalendario` de
 * `backend/src/services/agenda.calendario.ts`: a visita marcada no check-in
 * para um cliente (no dia marcado, mesmo vencida), um lembrete aberto (no dia
 * dele), um dia de campanha (só para o gestor) ou uma data sazonal.
 */
export type ItemCalendario = {
  /** `AAAA-MM-DD`. */
  data: string;
  tipo: 'VISITA' | 'LEMBRETE' | 'CAMPANHA' | 'DATA_SAZONAL';
  /** Nome do cliente, da campanha ou do evento. */
  titulo: string;
  clienteId?: string;
  /** Só no lembrete: o id dele, que separa visita e lembrete do mesmo cliente no dia (concluir fica na agenda do dia e na ficha). */
  lembreteId?: string;
  /** Só no lembrete: o texto. */
  texto?: string;
  representante?: { id: string; nome: string };
  /** Na visita, a campanha da próxima visita; na campanha, ela mesma. */
  campanha?: { id: string; nome: string } | null;
  /** Texto pronto do backend: vencimento da visita ou do lembrete, tipo e período da campanha, "Data sazonal". */
  detalhe?: string;
};

export type Calendario = {
  /** `AAAA-MM`. */
  mes: string;
  /** Por dia; no mesmo dia, data sazonal, campanha e visitas da mais urgente para a menos. */
  itens: ItemCalendario[];
};

/** `mes` no formato `AAAA-MM`; `representanteId` como em `buscarAgendaDoDia`. */
export function buscarCalendario(mes: string, representanteId?: string): Promise<Calendario> {
  const qs = new URLSearchParams({ mes, ...(representanteId ? { representanteId } : {}) });
  return api.get<{ data: Calendario }>(`/agenda/calendario?${qs}`).then((resposta) => resposta.data);
}
