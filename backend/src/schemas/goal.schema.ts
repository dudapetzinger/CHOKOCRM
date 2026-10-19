import { z } from 'zod';
import { representanteIdFiltroSchema } from './client.schema';

/**
 * Validação das metas de visitas e vendas (spec 7.8), na criação e na
 * alteração (`PUT`, que troca a meta inteira). O serviço confere o que
 * depende do banco: representante ativo e com papel REPRESENTANTE, campanha
 * existente e a meta dentro do período dela; nas metas semanal e mensal, o
 * período sai da data de início.
 */

const MENSAGEM_REPRESENTANTE = 'Escolha um representante.';
const MENSAGEM_FIM_ANTES_DO_INICIO = 'A data de fim deve ser depois do início.';
const MENSAGEM_META_VISITAS = 'A meta de visitas deve ser um número inteiro maior ou igual a 0.';
const MENSAGEM_META_VENDAS = 'A meta de vendas deve ser um valor maior ou igual a 0.';
const MENSAGEM_CAMPANHA_OBRIGATORIA = 'Informe a campanha da meta.';
const MENSAGEM_CAMPANHA_SO_NO_PERIODO_CAMPANHA = 'Só a meta por campanha pode ter campanha.';
const MAXIMO_META_VISITAS = 100_000;
/** O que cabe em `Decimal(12, 2)`. */
const MAXIMO_META_VENDAS = 9_999_999_999.99;

export const PERIODOS_META = ['SEMANAL', 'MENSAL', 'PERSONALIZADO', 'CAMPANHA'] as const;

/** Data de calendário `AAAA-MM-DD` (data que não existe, como 30/02, é recusada). */
function dataSchema(mensagem: string) {
  return z.iso.date({ error: mensagem });
}

export const metaSchema = z
  .object({
    representanteId: z.string({ error: MENSAGEM_REPRESENTANTE }).trim().min(1, MENSAGEM_REPRESENTANTE),
    periodo: z.enum(PERIODOS_META, 'Período deve ser SEMANAL, MENSAL, PERSONALIZADO ou CAMPANHA.'),
    inicio: dataSchema('Data de início inválida.'),
    fim: dataSchema('Data de fim inválida.'),
    metaVisitas: z
      .number({ error: MENSAGEM_META_VISITAS })
      .int(MENSAGEM_META_VISITAS)
      .min(0, MENSAGEM_META_VISITAS)
      .max(MAXIMO_META_VISITAS, `A meta de visitas pode ser no máximo ${MAXIMO_META_VISITAS}.`),
    /** Em reais; arredondada a 2 casas (a coluna é `Decimal(12, 2)`). Texto ("6000") é recusado. */
    metaVendas: z
      .number({ error: MENSAGEM_META_VENDAS })
      .min(0, MENSAGEM_META_VENDAS)
      .max(MAXIMO_META_VENDAS, 'A meta de vendas pode ser no máximo R$ 9.999.999.999,99.')
      .transform((valor) => Math.round(valor * 100) / 100),
    /** Só na meta CAMPANHA (e nela é obrigatória). */
    campanhaId: z
      .string({ error: 'Campanha inválida.' })
      .trim()
      .min(1, MENSAGEM_CAMPANHA_OBRIGATORIA)
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((meta, ctx) => {
    if (meta.fim < meta.inicio) {
      ctx.addIssue({ code: 'custom', message: MENSAGEM_FIM_ANTES_DO_INICIO, path: ['fim'] });
    }
    if (meta.periodo === 'CAMPANHA' && meta.campanhaId === null) {
      ctx.addIssue({ code: 'custom', message: MENSAGEM_CAMPANHA_OBRIGATORIA, path: ['campanhaId'] });
    }
    if (meta.periodo !== 'CAMPANHA' && meta.campanhaId !== null) {
      ctx.addIssue({ code: 'custom', message: MENSAGEM_CAMPANHA_SO_NO_PERIODO_CAMPANHA, path: ['campanhaId'] });
    }
  });

export type MetaInput = z.infer<typeof metaSchema>;

/**
 * Query da lista: `?campanhaId=` (sem ele, só as metas sem campanha) e
 * `?representanteId=` (o representante sempre recebe só as próprias).
 * Parâmetros desconhecidos são ignorados.
 */
export const listarMetasQuerySchema = z.object({
  campanhaId: z.string().uuid('Identificador da campanha inválido.').optional(),
  representanteId: representanteIdFiltroSchema,
});

export type ListarMetasQuery = z.infer<typeof listarMetasQuerySchema>;
