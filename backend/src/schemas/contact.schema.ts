import { z } from 'zod';

/**
 * Validação de contatos (UC04). Espelha o `contatoSchema` interno de
 * `client.schema.ts`: nome/cargo/telefone/email obrigatórios e `principal`
 * como boolean explícito, refletindo a obrigatoriedade "Sim" do dicionário
 * de dados para todos os campos de `Contact`.
 */

export const createContactSchema = z.object({
  nome: z.string().min(1, 'Nome do contato é obrigatório.'),
  cargo: z.string().min(1, 'Cargo do contato é obrigatório.'),
  telefone: z.string().min(1, 'Telefone do contato é obrigatório.'),
  email: z.string().email('E-mail do contato inválido.'),
  principal: z.boolean(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

/**
 * Atualização parcial (UC04, alternativa A1) — qualquer subconjunto dos
 * campos do contato pode ser enviado, incluindo `principal` isoladamente
 * para promover/rebaixar (regras de negócio em contact.service.ts).
 */
export const updateContactSchema = z
  .object({
    nome: z.string().min(1, 'Nome do contato é obrigatório.').optional(),
    cargo: z.string().min(1, 'Cargo do contato é obrigatório.').optional(),
    telefone: z.string().min(1, 'Telefone do contato é obrigatório.').optional(),
    email: z.string().email('E-mail do contato inválido.').optional(),
    principal: z.boolean().optional(),
  })
  .strict();

export type UpdateContactInput = z.infer<typeof updateContactSchema>;
