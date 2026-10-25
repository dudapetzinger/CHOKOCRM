import type { Cor } from '../services/classificacao.service';

/**
 * Parâmetros do painel de indicadores do gestor (Etapa 6C): período de
 * análise padrão, o único conjunto de períodos aceito pela rota e as cores
 * da classificação composta que contam como cliente "inativo": LARANJA e
 * VERMELHO (o LARANJA também vem do rebaixamento pelo ERP; ver
 * classificacao.service.ts).
 */
export const PERIODO_PADRAO_DIAS = 30;
export const PERIODOS_DIAS = [30, 90, 365] as const;
/** Teto, em dias, do período de visualização do Painel (indicadores e comparativo); a Planilha (relatório) e as metas não têm teto. */
export const LIMITE_DIAS_DO_PAINEL = 365;
export const CORES_INATIVAS: readonly Cor[] = ['LARANJA', 'VERMELHO'];

/** Semanas do ritmo de visitas do Painel (spec da Etapa 8, 7.10): as 8 últimas, a última contendo hoje. */
export const SEMANAS_DO_RITMO = 8;
