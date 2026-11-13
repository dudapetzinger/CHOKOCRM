import { z } from 'zod';
import { representanteIdFiltroSchema } from './client.schema';
import { camposDoPeriodo, validarPeriodo } from './periodo.schema';

/**
 * Query dos indicadores do Painel e do relatório da planilha:
 * o período (`camposDoPeriodo`, em dias ou por datas, nunca os dois;
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
 * Query das vendas mensais da carteira: o mesmo período do Painel (dias ou
 * datas) e `?representanteId=`; a janela de meses segue o período.
 */
export const vendasMensaisQuerySchema = periodoQuerySchema;
