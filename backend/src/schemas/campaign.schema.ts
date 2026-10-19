import { z } from 'zod';

/**
 * Validação das campanhas, promoções e eventos (spec 7.7), na criação e na
 * alteração (`PUT`, que troca a campanha inteira: campo opcional ausente
 * volta ao padrão). Os SKUs são conferidos no catálogo do ERP no serviço,
 * com a mensagem própria.
 */

const MENSAGEM_NOME = 'Dê um nome à campanha.';
const MENSAGEM_FIM_ANTES_DO_INICIO = 'A data de fim deve ser depois do início.';
const MENSAGEM_DESCONTO = 'O desconto deve ser um número inteiro de 0 a 100.';
const MAXIMO_NOME = 100;
const MAXIMO_DESCRICAO = 1000;
const MAXIMO_PRODUTOS = 30;

/** Data de calendário `AAAA-MM-DD` (data que não existe, como 30/02, é recusada). */
function dataSchema(mensagem: string) {
  return z.iso.date({ error: mensagem });
}

export const campanhaSchema = z
  .object({
    nome: z
      .string({ error: MENSAGEM_NOME })
      .trim()
      .min(1, MENSAGEM_NOME)
      .max(MAXIMO_NOME, `O nome pode ter no máximo ${MAXIMO_NOME} caracteres.`),
    tipo: z.enum(['CAMPANHA', 'PROMOCAO', 'EVENTO'], 'Tipo deve ser CAMPANHA, PROMOCAO ou EVENTO.'),
    inicio: dataSchema('Data de início inválida.'),
    fim: dataSchema('Data de fim inválida.'),
    descricao: z
      .string({ error: 'Descrição inválida.' })
      .trim()
      .max(MAXIMO_DESCRICAO, `A descrição pode ter no máximo ${MAXIMO_DESCRICAO} caracteres.`)
      .default(''),
    /** Em %; `null` ou ausente = sem desconto. Texto ("15") é recusado. */
    desconto: z
      .number({ error: MENSAGEM_DESCONTO })
      .int(MENSAGEM_DESCONTO)
      .min(0, MENSAGEM_DESCONTO)
      .max(100, MENSAGEM_DESCONTO)
      .nullable()
      .default(null),
    /** SKUs em destaque; repetidos viram um só, na ordem em que vieram. */
    produtos: z
      .array(z.string({ error: 'Produto inválido.' }).trim().min(1, 'Produto inválido.'))
      .max(MAXIMO_PRODUTOS, `A campanha pode ter no máximo ${MAXIMO_PRODUTOS} produtos.`)
      .default([])
      .transform((skus) => [...new Set(skus)]),
  })
  .strict()
  .refine((campanha) => campanha.fim >= campanha.inicio, {
    message: MENSAGEM_FIM_ANTES_DO_INICIO,
    path: ['fim'],
  });

export type CampanhaInput = z.infer<typeof campanhaSchema>;
