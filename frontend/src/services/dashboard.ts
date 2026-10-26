/**
 * Acesso tipado aos números dos gráficos do Painel (Etapa 7; contagens por
 * resultado, ritmo e relatório da planilha na Etapa 8; período personalizado
 * e detalhe por cliente na Etapa 9): o comparativo por representante, o ritmo
 * de visitas (por semana ou por mês, conforme o período), as vendas mensais da
 * carteira e as linhas do CSV. Espelha `KpisPorRepresentanteDTO` de
 * `backend/src/services/kpis.service.ts`, `KpiRepresentante`, `Ritmo` e
 * `FaixaDoRitmo` de `kpis.regras.ts`, `VendasMensaisDTO` de
 * `vendas-mensais.service.ts` e `LinhaDoRelatorioDTO` de
 * `relatorio.service.ts`. Gestor e representante leem; para o representante,
 * o backend ignora o `representanteId` e usa a carteira dele. O período é um
 * `Periodo` (`lib/periodo`).
 */
import { queryDoPeriodo, type Periodo } from '../lib/periodo';
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
  /** R$ vendidos no período (pedidos das visitas com venda). */
  receita: number;
  /** Os clientes do representante, com o resultado das visitas de cada um no período. */
  clientes: { id: string; nomeFantasia: string; vendas: number; negociacoes: number; semVenda: number }[];
};

/** Uma coluna do ritmo: a semana (segunda a domingo) ou o mês, conforme a `granularidade`. */
export type FaixaDoRitmo = {
  /** 'AAAA-MM-DD'. */
  inicio: string;
  /** 'AAAA-MM-DD'. */
  fim: string;
  /** A faixa que o período cortou (a primeira ou a última): tem menos dias que a semana ou o mês. */
  parcial: boolean;
  visitas: number;
  /** Das visitas da faixa, as com resultado VENDA. */
  vendas: number;
  clientes: { id: string; nomeFantasia: string; visitas: number; vendas: number }[];
};

export type Ritmo = {
  granularidade: 'SEMANA' | 'MES';
  faixas: FaixaDoRitmo[];
};

export type KpisPorRepresentante = {
  periodo: Kpis['periodo'];
  /** Ordenados por visitas (desc) e nome; todos aparecem, mesmo zerados. */
  representantes: KpiRepresentante[];
  /** Cobre o período escolhido: por semana ou por mês, conforme o tamanho dele. */
  ritmo: Ritmo;
  simulado: boolean;
};

export type VendaDoMes = {
  /** 'AAAA-MM'. */
  mes: string;
  /** R$ vendidos no mês. */
  total: number;
  clientesComDados: number;
  /** Quanto cada cliente comprou no mês. */
  clientes: { id: string; nomeFantasia: string; total: number }[];
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
  periodo: Periodo,
  representanteId?: string,
): Promise<KpisPorRepresentante> {
  const query = comRepresentante(queryDoPeriodo(periodo), representanteId);
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

export async function buscarRelatorio(periodo: Periodo, representanteId?: string): Promise<LinhaDoRelatorio[]> {
  const query = comRepresentante(queryDoPeriodo(periodo), representanteId);
  const resposta = await api.get<{ data: LinhaDoRelatorio[] }>(`/dashboard/relatorio?${query}`);
  return resposta.data;
}
