/**
 * Acesso tipado aos indicadores do painel do gestor (UC14, Etapa 6C). Espelha
 * `KpisDTO` de `backend/src/services/kpis.service.ts` e `Proporcao` /
 * `DistribuicaoPorCor` de `backend/src/services/kpis.regras.ts`. Datas de
 * calendário chegam como 'AAAA-MM-DD' (formatar com `formatarDataCalendario`).
 * O período é um `Periodo` (30, 90 ou 365 dias, ou uma faixa personalizada de
 * até 365 dias), traduzido por `queryDoPeriodo`.
 */
import { queryDoPeriodo, type Periodo } from '../lib/periodo';
import { api } from './api';
import type { Cor } from './clients';

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
  /** Nenhuma visita nem mensagem no período. */
  semDados: boolean;
  /** A cor composta consulta o ERP, que ainda é simulado. */
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
