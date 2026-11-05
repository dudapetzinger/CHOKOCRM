import { z } from 'zod';
import { recorrenciaDiasSchema } from './client.schema';

/**
 * Cliente pela nota fiscal: `POST /erp/sem-cliente/:cnpj/cliente`. O gestor
 * escolhe o representante (dono da carteira) e pode trocar o nome fantasia
 * (padrão: a razão social da nota) e a recorrência (padrão: 15 dias).
 */
export const cnpjDaNotaParamSchema = z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos.');

export const criarClientePelaNotaSchema = z.object({
  representanteId: z.string().uuid('Identificador do representante inválido.'),
  nomeFantasia: z.string().trim().min(1, 'Nome fantasia é obrigatório.').optional(),
  recorrenciaDias: recorrenciaDiasSchema.optional(),
});

export type CriarClientePelaNotaInput = z.infer<typeof criarClientePelaNotaSchema>;
