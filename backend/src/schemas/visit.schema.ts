import { z } from 'zod';

/**
 * Validação do check-in de visita (UC07), com o pedido opcional da visita
 * com venda, e da edição posterior da descrição (UC08), que não mexe no
 * pedido. O schema Prisma (`prisma/schema.prisma`) exige
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

const MAXIMO_ITENS_DO_PEDIDO = 30;
const MAXIMO_QUANTIDADE_POR_ITEM = 99999;
const MENSAGEM_QUANTIDADE = 'Quantidade do item deve ser um número inteiro maior que zero.';

/**
 * Item do pedido (spec 7.5): só o SKU e a quantidade. Nome e preço vêm do
 * catálogo do ERP no serviço — por isso o objeto é `strict`: um preço
 * mandado pelo cliente HTTP é recusado, nunca usado. Quantidade em texto
 * ("10") também é recusada, como a data solta acima.
 */
const itemDoPedidoSchema = z
  .object({
    sku: z.string({ message: 'Informe o produto do item.' }).trim().min(1, 'Informe o produto do item.'),
    quantidade: z
      .number({ message: MENSAGEM_QUANTIDADE })
      .int(MENSAGEM_QUANTIDADE)
      .min(1, MENSAGEM_QUANTIDADE)
      .max(MAXIMO_QUANTIDADE_POR_ITEM, `Quantidade do item não pode passar de ${MAXIMO_QUANTIDADE_POR_ITEM}.`),
  })
  .strict();

export const createVisitSchema = z
  .object({
    descricao: descricaoSchema,
    resultado: z.enum(['VENDA', 'NEGOCIACAO', 'SEM_VENDA'], {
      message: 'Resultado deve ser VENDA, NEGOCIACAO ou SEM_VENDA.',
    }),
    dataHora: dataHoraSchema.optional(),
    contactId: z.string().uuid('Identificador do contato inválido.').optional(),
    /** Pedido, só com resultado VENDA (regra no serviço, com a mensagem própria). */
    itens: z
      .array(itemDoPedidoSchema)
      .max(MAXIMO_ITENS_DO_PEDIDO, `O pedido pode ter no máximo ${MAXIMO_ITENS_DO_PEDIDO} itens.`)
      .optional(),
  })
  .strict();

export type CreateVisitInput = z.infer<typeof createVisitSchema>;

/** Edição posterior altera apenas a descrição (ver UC08). */
export const updateVisitSchema = z.object({ descricao: descricaoSchema }).strict();

export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;
