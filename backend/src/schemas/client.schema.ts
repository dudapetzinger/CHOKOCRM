import { z } from 'zod';
import { CORES } from '../services/classificacao.service';
import { proximaVisitaSchema } from './visit.schema';

/**
 * Validação da atualização e da listagem de clientes. O e-mail do Client é
 * opcional no banco (o cliente criado pela nota fiscal nasce sem ele); na
 * atualização, `null` apaga. Clientes só nascem pela nota fiscal
 * (`cliente-pela-nota.schema.ts`).
 */

const cnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos.');

export const recorrenciaDiasSchema = z
  .number()
  .int('Recorrência de visitas deve ser um número inteiro.')
  .min(1, 'Recorrência de visitas deve ser entre 1 e 365 dias.')
  .max(365, 'Recorrência de visitas deve ser entre 1 e 365 dias.');

/**
 * Atualização parcial: nunca inclui `contatos` (gerenciados pelas rotas
 * de contato). Campos ausentes do body permanecem
 * inalterados; `ativo` (inativar ou reativar o cliente) só pode ser enviado por um
 * GESTOR.
 * Não inclui `recorrenciaDias`: sua alteração tem rota dedicada,
 * com justificativa obrigatória.
 * `representanteId`, quando presente, só pode ser enviado por um GESTOR
 * (regra aplicada em client.service.ts) e transfere a carteira do cliente.
 * `proximaVisita` marca, troca ou limpa a próxima visita pela
 * ficha, com a mesma regra do check-in (`AAAA-MM-DD`, hoje ou depois); `null`
 * apaga a data e a campanha da próxima visita (aplicado em client.service.ts).
 * Ausente, a data marcada não muda.
 */
export const updateClientSchema = z
  .object({
    razaoSocial: z.string().min(1, 'Razão social é obrigatória.').optional(),
    nomeFantasia: z.string().min(1, 'Nome fantasia é obrigatório.').optional(),
    cnpj: cnpjSchema.optional(),
    cidade: z.string().min(1, 'Cidade é obrigatória.').optional(),
    endereco: z.string().min(1, 'Endereço é obrigatório.').optional(),
    telefone: z.string().min(1, 'Telefone é obrigatório.').optional(),
    email: z.string().email('E-mail inválido.').nullable().optional(),
    erpId: z.string().min(1, 'Identificador de ERP não pode ser vazio.').optional(),
    ativo: z.boolean().optional(),
    representanteId: z.string().uuid('Identificador do representante inválido.').optional(),
    proximaVisita: proximaVisitaSchema.nullable().optional(),
  })
  .strict();

export type UpdateClientInput = z.infer<typeof updateClientSchema>;

/**
 * Filtro `?representanteId=` das visões agregadas (lista de clientes,
 * agenda, indicadores, alertas). Só o gestor o usa de fato; para o
 * representante o service ignora o valor (ver `representanteEfetivo`), mas
 * o formato é validado para todos.
 */
export const representanteIdFiltroSchema = z.string().uuid('Identificador do representante inválido.').optional();

export const listClientsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  ativo: z.string().optional(),
  color: z.enum(CORES, { message: 'Cor deve ser VERDE, AMARELO, LARANJA ou VERMELHO.' }).optional(),
  representanteId: representanteIdFiltroSchema,
});

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
