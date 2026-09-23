import { z } from 'zod';

/**
 * Validação do check-in de visita (UC07) e da edição posterior da
 * descrição (UC08). O schema Prisma (`prisma/schema.prisma`) exige
 * `descricao` e `resultado` como NOT NULL — este zod reflete a mesma
 * obrigatoriedade, conforme o dicionário de dados
 * (docs/modelo-de-dados.md).
 */

const MENSAGEM_DESCRICAO = 'Descrição da visita é obrigatória e deve ter pelo menos 3 caracteres.';
const MENSAGEM_DATA_INVALIDA = 'Data e hora da visita inválidas.';
const MENSAGEM_DATA_FUTURA = 'Data e hora da visita não podem estar no futuro.';

const descricaoSchema = z.string().trim().min(3, MENSAGEM_DESCRICAO);

/**
 * Data/hora entra **exclusivamente** como ISO 8601, com `Z` ou com offset
 * (`-03:00`, que é o que o celular envia). Coerção solta (`z.coerce.date`)
 * não serve aqui: ela delega para `new Date(valor)`, que engole `null`,
 * `true`, `0` e `"05/09/2026"` — todos viram uma visita gravada em 1970 ou
 * na data errada. Como só a descrição é editável (UC08) e não há exclusão
 * de visita, esse registro ficaria errado para sempre e ainda distorceria
 * a classificação por cor do cliente (UC05).
 *
 * O limite superior usa `refine`, e não `max`, porque é "agora, no momento
 * da requisição": um `max(new Date())` ficaria congelado no instante em
 * que o módulo foi carregado e passaria a recusar check-ins legítimos
 * conforme o servidor envelhece.
 */
const dataHoraSchema = z
  .string({ message: MENSAGEM_DATA_INVALIDA })
  .datetime({ offset: true, message: MENSAGEM_DATA_INVALIDA })
  .transform((valor) => new Date(valor))
  .refine((data) => data.getTime() <= Date.now(), { message: MENSAGEM_DATA_FUTURA });

export const createVisitSchema = z
  .object({
    descricao: descricaoSchema,
    resultado: z.enum(['VENDA', 'NEGOCIACAO', 'SEM_VENDA'], {
      message: 'Resultado deve ser VENDA, NEGOCIACAO ou SEM_VENDA.',
    }),
    dataHora: dataHoraSchema.optional(),
    contactId: z.string().uuid('Identificador do contato inválido.').optional(),
  })
  .strict();

export type CreateVisitInput = z.infer<typeof createVisitSchema>;

/** Edição posterior altera apenas a descrição (ver UC08). */
export const updateVisitSchema = z.object({ descricao: descricaoSchema }).strict();

export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
