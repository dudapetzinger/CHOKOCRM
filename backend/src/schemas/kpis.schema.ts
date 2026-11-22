import { z } from 'zod';
import { representanteIdFiltroSchema } from './client.schema';
import { horizonteQuerySchema } from './insights.schema';
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
 * datas) e `?representanteId=`; a janela de meses segue o período. Com
 * `?ateProximaData=true`, a série vai até o mês da próxima data comemorativa
 * dentro de `?horizonteDias=` (mesmos limites e padrão dos insights).
 */
export const vendasMensaisQuerySchema = z
  .object({
    ...camposDoPeriodo,
    representanteId: representanteIdFiltroSchema,
    ateProximaData: z
      .enum(['true', 'false'], { error: 'ateProximaData deve ser true ou false.' })
      .optional()
      .transform((valor) => valor === 'true'),
    horizonteDias: horizonteQuerySchema.shape.horizonteDias,
  })
  .superRefine(validarPeriodo);
