import { z } from 'zod';
import { representanteIdFiltroSchema } from './client.schema';
import { camposDoPeriodo, validarPeriodo } from './periodo.schema';

/**
 * Query dos indicadores do Painel (UC14) e do relatório da planilha (spec
 * 7.12): o período (`camposDoPeriodo`, em dias ou por datas, nunca os dois;
 * sem nenhum, vale o padrão) e `?representanteId=`, que restringe à
 * carteira daquele representante. Parâmetros desconhecidos são ignorados.
 */
export const periodoQuerySchema = z
  .object({
    ...camposDoPeriodo,
    representanteId: representanteIdFiltroSchema,
  })
  .superRefine(validarPeriodo);

export type PeriodoQuery = z.infer<typeof periodoQuerySchema>;

/**
 * Query das vendas mensais da carteira: só `?representanteId=` (a janela é
 * fixa, 12 meses). Parâmetros desconhecidos são ignorados.
 */
export const vendasMensaisQuerySchema = z.object({
  representanteId: representanteIdFiltroSchema,
});
