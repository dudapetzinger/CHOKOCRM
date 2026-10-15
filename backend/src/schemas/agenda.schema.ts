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
