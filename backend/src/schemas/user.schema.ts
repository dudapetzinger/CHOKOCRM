import { z } from 'zod';

/**
 * Query da listagem de usuários do gestor: `?role=` é obrigatório e só aceita
 * `REPRESENTANTE` — a única consulta de que a interface precisa (seletor de
 * representante); listar gestores não tem uso e fica fora da API.
 */
export const roleQuerySchema = z.object({
  role: z.literal('REPRESENTANTE', 'Role deve ser REPRESENTANTE.'),
});
