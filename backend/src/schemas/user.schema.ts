import { z } from 'zod';

/**
 * Validação da gestão de usuários e das senhas (spec da Etapa 8, 7.13).
 * E-mails saem daqui já sem espaços e em minúsculas — é assim que são
 * gravados e comparados (login, unicidade no cadastro e na edição).
 */

export const MENSAGEM_SENHA_CURTA = 'A senha deve ter pelo menos 6 caracteres.';

/** Mínimo de 6 caracteres em todo lugar: criar conta, alterar e redefinir senha. */
export const senhaSchema = z.string().min(6, MENSAGEM_SENHA_CURTA);

const emailSchema = z.string().trim().toLowerCase().email('E-mail inválido.');

/** Vazio ou `null` = sem telefone (grava `null`). */
const telefoneSchema = z
  .string()
  .trim()
  .nullable()
  .transform((telefone) => (telefone ? telefone : null));

const nomeSchema = z.string().trim().min(1, 'Nome é obrigatório.');

const roleSchema = z.enum(['REPRESENTANTE', 'GESTOR'], 'Papel deve ser REPRESENTANTE ou GESTOR.');

/**
 * Query da listagem de usuários do gestor: sem `role`, todos (tela de
 * Usuários); `?role=REPRESENTANTE` mantém o contrato do seletor de
 * representante (só ativos, id e nome). Listar só gestores não tem uso.
 */
export const listUsersQuerySchema = z.object({
  role: z.literal('REPRESENTANTE', 'Role deve ser REPRESENTANTE.').optional(),
});

export const createUserSchema = z
  .object({
    nome: nomeSchema,
    email: emailSchema,
    telefone: telefoneSchema.optional(),
    role: roleSchema,
    senha: senhaSchema,
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Edição parcial: campos ausentes ficam como estão. A senha não muda por aqui. */
export const updateUserSchema = z
  .object({
    nome: nomeSchema.optional(),
    email: emailSchema.optional(),
    telefone: telefoneSchema.optional(),
    role: roleSchema.optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const transferirCarteiraSchema = z.object({
  destinoId: z.string().uuid('Identificador do representante inválido.'),
});

export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual é obrigatória.'),
  novaSenha: senhaSchema,
});

export const redefinirSenhaSchema = z.object({
  token: z.string().min(1, 'Link de redefinição inválido.'),
  novaSenha: senhaSchema,
});
