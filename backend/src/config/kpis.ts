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
export const CORES_INATIVAS: readonly Cor[] = ['LARANJA', 'VERMELHO'];
