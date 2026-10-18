/**
 * Acesso tipado aos números dos gráficos do Painel do gestor (Etapa 7;
 * contagens por resultado e ritmo semanal na Etapa 8): o comparativo por
 * representante, o ritmo de visitas das 8 últimas semanas e as vendas
 * mensais da carteira. Espelha `KpisPorRepresentanteDTO` de
 * `backend/src/services/kpis.service.ts`, `KpiRepresentante` e
 * `SemanaDoRitmo` de `kpis.regras.ts` e `VendasMensaisDTO` de
 * `vendas-mensais.service.ts`. Os dois endpoints são só do gestor.
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
