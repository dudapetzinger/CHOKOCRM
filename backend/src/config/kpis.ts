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

/** Maior período, em dias, em que o ritmo de visitas do Painel é por semana; acima disso é por mês (13 semanas = 91 dias). */
export const DIAS_MAXIMOS_DO_RITMO_SEMANAL = 91;
