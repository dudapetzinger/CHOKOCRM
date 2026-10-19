import { z } from 'zod';
import { representanteIdFiltroSchema } from './client.schema';

/**
 * Query da agenda do dia (UC10): `?representanteId=` restringe a agenda do
 * gestor à carteira daquele representante (o representante sempre vê a
 * própria). Parâmetros desconhecidos são ignorados.
 */
export const agendaQuerySchema = z.object({
  representanteId: representanteIdFiltroSchema,
});

const MENSAGEM_MES = 'Mês deve estar no formato AAAA-MM.';

/**
 * Query do calendário da Agenda (spec 7.6): `?mes=AAAA-MM` (obrigatório, mês
 * de 01 a 12) e o mesmo `representanteId` da agenda do dia.
 */
export const calendarioQuerySchema = z.object({
  mes: z.string({ error: MENSAGEM_MES }).regex(/^\d{4}-(0[1-9]|1[0-2])$/, MENSAGEM_MES),
  representanteId: representanteIdFiltroSchema,
});
