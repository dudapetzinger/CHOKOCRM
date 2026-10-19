import { z } from 'zod';
import { PERIODO_PADRAO_DIAS, PERIODOS_DIAS } from '../config/kpis';
import { representanteIdFiltroSchema } from './client.schema';

const MENSAGEM_PERIODO = 'Período deve ser 30, 90 ou 365 dias.';

/**
 * Query dos indicadores do Painel (UC14) e do relatório da planilha (spec
 * 7.12): `?periodoDias=` é a janela de análise, em dias, e só aceita os
 * valores de `PERIODOS_DIAS`. Ausente, vale
 * o padrão; `?representanteId=` restringe à carteira daquele representante.
 * Parâmetros desconhecidos são ignorados.
 */
export const periodoQuerySchema = z.object({
  periodoDias: z.coerce
    .number(MENSAGEM_PERIODO)
    .int(MENSAGEM_PERIODO)
    .refine((valor) => (PERIODOS_DIAS as readonly number[]).includes(valor), MENSAGEM_PERIODO)
    .default(PERIODO_PADRAO_DIAS),
  representanteId: representanteIdFiltroSchema,
});

/**
 * Query das vendas mensais da carteira: só `?representanteId=` (a janela é
 * fixa, 12 meses). Parâmetros desconhecidos são ignorados.
 */
export const vendasMensaisQuerySchema = z.object({
  representanteId: representanteIdFiltroSchema,
});
