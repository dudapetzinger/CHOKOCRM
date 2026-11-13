import { z } from 'zod';

/**
 * Validação da gestão de usuários e das senhas.
 * O usuário sai daqui já sem espaços e em minúsculas: é assim que é
 * gravado e comparado (login, unicidade no cadastro e na edição).
 */

export const MENSAGEM_SENHA_CURTA = 'A senha deve ter pelo menos 6 caracteres.';

/** Mínimo de 6 caracteres em todo lugar: criar conta, alterar a própria senha e a senha provisória. */
export const senhaSchema = z.string().min(6, MENSAGEM_SENHA_CURTA);

export const MENSAGEM_USUARIO_INVALIDO =
  'Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.';

/** Nome de acesso da conta, no cadastro e na edição. */
export const usuarioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, MENSAGEM_USUARIO_INVALIDO);

/**
 * Usuário e senha de quem entra (login e modo demonstração). O usuário só é
 * aparado e posto em minúsculas, sem a regra de formato do cadastro: o que
 * não existe cai no 401 genérico.
 */
export const credenciaisSchema = z.object({
  usuario: z.string().trim().toLowerCase().min(1, 'Usuário é obrigatório.'),
  senha: z.string().min(1, 'Senha é obrigatória.'),
});

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
    usuario: usuarioSchema,
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
    usuario: usuarioSchema.optional(),
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

/** Senha provisória que o gestor define para uma conta (`PUT /users/:id/senha`). */
export const definirSenhaSchema = z.object({
  senha: senhaSchema,
});
