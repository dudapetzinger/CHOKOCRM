/**
 * Acesso tipado aos indicadores do painel do gestor. Espelha
 * `KpisDTO` de `backend/src/services/kpis.service.ts` e `Proporcao` /
 * `DistribuicaoPorCor` de `backend/src/services/kpis.regras.ts`. Datas de
 * calendário chegam como 'AAAA-MM-DD' (formatar com `formatarDataCalendario`).
 * O período é um `Periodo` (30, 90 ou 365 dias, ou uma faixa personalizada de
 * até 365 dias), traduzido por `queryDoPeriodo`.
 */
import { queryDoPeriodo, type Periodo } from '../lib/periodo';
import { api } from './api';
import type { Cor } from './clients';
import type { ResultadoVisita } from './visits';

export type DistribuicaoPorCor = Record<Cor, number>;

/** `percentual` é inteiro arredondado; `null` quando o denominador é 0. */
export type Proporcao = { numerador: number; denominador: number; percentual: number | null };

export type Kpis = {
  /** `inicio` e `fim` em 'AAAA-MM-DD'. */
  periodo: { dias: number; inicio: string; fim: string };
  clientesAtivos: number;
  visitas: { total: number; mediaPorCliente: number | null };
  taxaDeRegistro: Proporcao;
  conversaoEmVendas: Proporcao;
  inativos: { total: number; distribuicao: DistribuicaoPorCor };
  /** Nenhuma visita no período. */
  semDados: boolean;
  /** Verdadeiro quando os dados de compra usados na cor vêm da fonte simulada. */
  simulado: boolean;
};

/** `representanteId` só faz efeito para o gestor; vai na query só quando definido. */
export function buscarKpis(periodo: Periodo, representanteId?: string): Promise<Kpis> {
  const query = queryDoPeriodo(periodo);
  if (representanteId) {
    query.set('representanteId', representanteId);
  }
  return api.get<Kpis>(`/dashboard/kpis?${query}`);
}

/** Uma visita do período (`GET /dashboard/kpis/visitas`). */
export type VisitaDoPeriodo = {
  visitaId: string;
  clienteId: string;
  nomeFantasia: string;
  cidade: string;
  /** Os indicadores só contam clientes ativos. */
  clienteAtivo: boolean;
  /** O dono da carteira do cliente (como os indicadores agrupam), não o autor da visita. */
  representanteId: string;
  representanteNome: string;
  /** Instante ISO. */
  dataHora: string;
  /** 'AAAA-MM-DD': o `inicio` da faixa do ritmo a que a visita pertence. */
  faixaInicio: string;
  resultado: ResultadoVisita;
  /** R$ do pedido nas visitas com venda; 0 nas demais. */
  valor: number;
};

/** Cliente ativo sem visita no período. */
export type ClienteNaoVisitado = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  representanteId: string;
  representanteNome: string;
  /** Instante ISO da visita mais recente de todas, não só do período; `null`: nunca visitado. */
  ultimaVisita: string | null;
  diasSemVisita: number | null;
};

export type DetalheDasVisitas = {
  periodo: Kpis['periodo'];
  granularidade: 'SEMANA' | 'MES';
  /** Da mais recente para a mais antiga. */
  visitas: VisitaDoPeriodo[];
  naoVisitados: ClienteNaoVisitado[];
  simulado: boolean;
};

/** Os mesmos parâmetros dos indicadores; o detalhe só é pedido quando um painel abre. */
export function buscarVisitasDoPeriodo(periodo: Periodo, representanteId?: string): Promise<DetalheDasVisitas> {
  const query = queryDoPeriodo(periodo);
  if (representanteId) {
    query.set('representanteId', representanteId);
  }
  return api.get<DetalheDasVisitas>(`/dashboard/kpis/visitas?${query}`);
}
