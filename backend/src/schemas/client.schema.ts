import { z } from 'zod';

/**
 * Validação de clientes e contatos (UC02/UC03/UC04). O schema Prisma
 * (`prisma/schema.prisma`) exige endereco/email do Client e cargo/telefone/
 * email do Contact como NOT NULL — este zod reflete essa obrigatoriedade,
 * conforme o dicionário de dados (docs/modelo-de-dados.md).
 */

const MENSAGEM_CONTATO_PRINCIPAL_UNICO = 'Cadastro exige exatamente um contato marcado como principal.';

const cnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos.');

const recorrenciaDiasSchema = z
  .number()
  .int('Recorrência de visitas deve ser um número inteiro.')
  .min(1, 'Recorrência de visitas deve ser entre 1 e 365 dias.')
  .max(365, 'Recorrência de visitas deve ser entre 1 e 365 dias.');

const contatoSchema = z.object({
  nome: z.string().min(1, 'Nome do contato é obrigatório.'),
  cargo: z.string().min(1, 'Cargo do contato é obrigatório.'),
  telefone: z.string().min(1, 'Telefone do contato é obrigatório.'),
  email: z.string().email('E-mail do contato inválido.'),
  principal: z.boolean(),
});

export const createClientSchema = z
  .object({
    razaoSocial: z.string().min(1, 'Razão social é obrigatória.'),
    nomeFantasia: z.string().min(1, 'Nome fantasia é obrigatório.'),
    cnpj: cnpjSchema,
    cidade: z.string().min(1, 'Cidade é obrigatória.'),
    endereco: z.string().min(1, 'Endereço é obrigatório.'),
    telefone: z.string().min(1, 'Telefone é obrigatório.'),
    email: z.string().email('E-mail inválido.'),
    erpId: z.string().min(1, 'Identificador de ERP não pode ser vazio.').optional(),
    recorrenciaDias: recorrenciaDiasSchema.default(15),
    contatos: z.array(contatoSchema).min(1, 'Cadastro exige ao menos um contato.'),
  })
  .superRefine((data, ctx) => {
    const principais = data.contatos.filter((contato) => contato.principal);
    if (principais.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['contatos'],
        message: MENSAGEM_CONTATO_PRINCIPAL_UNICO,
      });
    }
  });

export type CreateClientInput = z.infer<typeof createClientSchema>;

/**
 * Atualização parcial (UC03) — nunca inclui `contatos` (gerenciados via
 * UC04, fora do escopo desta task). Campos ausentes do body permanecem
 * inalterados; `ativo: false` aciona a inativação lógica do cliente.
 */
export const updateClientSchema = z
  .object({
    razaoSocial: z.string().min(1, 'Razão social é obrigatória.').optional(),
    nomeFantasia: z.string().min(1, 'Nome fantasia é obrigatório.').optional(),
    cnpj: cnpjSchema.optional(),
    cidade: z.string().min(1, 'Cidade é obrigatória.').optional(),
    endereco: z.string().min(1, 'Endereço é obrigatório.').optional(),
    telefone: z.string().min(1, 'Telefone é obrigatório.').optional(),
    email: z.string().email('E-mail inválido.').optional(),
    erpId: z.string().min(1, 'Identificador de ERP não pode ser vazio.').optional(),
    recorrenciaDias: recorrenciaDiasSchema.optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const listClientsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  ativo: z.string().optional(),
});

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
