/**
 * Acesso tipado aos números dos gráficos do Painel (Etapa 7; contagens por
 * resultado, ritmo semanal e relatório da planilha na Etapa 8): o
 * comparativo por representante, o ritmo de visitas das 8 últimas semanas,
 * as vendas mensais da carteira e as linhas do CSV. Espelha
 * `KpisPorRepresentanteDTO` de `backend/src/services/kpis.service.ts`,
 * `KpiRepresentante` e `SemanaDoRitmo` de `kpis.regras.ts`,
 * `VendasMensaisDTO` de `vendas-mensais.service.ts` e `LinhaDoRelatorioDTO`
 * de `relatorio.service.ts`. Gestor e representante leem; para o
 * representante, o backend ignora o `representanteId` e usa a carteira dele.
 */
import { api } from './api';
import type { Kpis, Proporcao } from './kpis';

export type KpiRepresentante = {
  id: string;
  nome: string;
  clientesAtivos: number;
  visitas: number;
  /** `vendas + negociacoes + semVenda = visitas`, pelo resultado de cada visita. */
  vendas: number;
  negociacoes: number;
  semVenda: number;
  conversaoEmVendas: Proporcao;
};

export type SemanaDoRitmo = {
  /** Segunda-feira da semana, 'AAAA-MM-DD'. */
  inicio: string;
  visitas: number;
  /** Das visitas da semana, as com resultado VENDA. */
  vendas: number;
};

export type KpisPorRepresentante = {
  periodo: Kpis['periodo'];
  /** Ordenados por visitas (desc) e nome; todos aparecem, mesmo zerados. */
  representantes: KpiRepresentante[];
  /** Sempre 8 semanas (segunda a domingo), a última contendo hoje; não depende do período. */
  ritmoSemanal: SemanaDoRitmo[];
  simulado: boolean;
};

export type VendaDoMes = {
  /** 'AAAA-MM'. */
  mes: string;
  /** R$ vendidos no mês. */
  total: number;
  clientesComDados: number;
};

export type EventoNoGrafico = {
  chave: string;
  nome: string;
  /** 'AAAA-MM-DD'. */
  data: string;
};

export type VendasMensais = {
  /** 12 meses, do mais antigo ao atual. */
  meses: VendaDoMes[];
  /** Eventos sazonais que caem na janela dos 12 meses. */
  eventos: EventoNoGrafico[];
  simulado: boolean;
  /** Clientes ativos com `erpId`. */
  clientesConsultados: number;
  /** Dos consultados, quantos o ERP não conseguiu responder. */
  clientesIndisponiveis: number;
};

function comRepresentante(query: URLSearchParams, representanteId?: string): URLSearchParams {
  if (representanteId) {
    query.set('representanteId', representanteId);
  }
  return query;
}

export function buscarKpisPorRepresentante(
  periodoDias: number,
  representanteId?: string,
): Promise<KpisPorRepresentante> {
  const query = comRepresentante(new URLSearchParams({ periodoDias: String(periodoDias) }), representanteId);
  return api.get<KpisPorRepresentante>(`/dashboard/kpis/por-representante?${query}`);
}

export function buscarVendasMensais(representanteId?: string): Promise<VendasMensais> {
  const query = comRepresentante(new URLSearchParams(), representanteId).toString();
  return api.get<VendasMensais>(`/dashboard/vendas-mensais${query ? `?${query}` : ''}`);
}

/** Uma linha da planilha do Painel (spec 7.12), já em ordem de urgência. */
export type LinhaDoRelatorio = {
  cliente: string;
  cidade: string;
  representante: string;
  /** Rótulo da cor do cliente: "Verde", "Amarelo", "Laranja" ou "Vermelho". */
  situacao: string;
  /** `null`: nunca visitado. */
  diasSemVisita: number | null;
  visitasNoPeriodo: number;
  /** R$ dos pedidos das visitas com venda no período. */
  vendasNoPeriodo: number;
};

export async function buscarRelatorio(periodoDias: number, representanteId?: string): Promise<LinhaDoRelatorio[]> {
  const query = comRepresentante(new URLSearchParams({ periodoDias: String(periodoDias) }), representanteId);
  const resposta = await api.get<{ data: LinhaDoRelatorio[] }>(`/dashboard/relatorio?${query}`);
  return resposta.data;
}
