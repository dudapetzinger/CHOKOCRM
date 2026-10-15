import { z } from 'zod';
import { HORIZONTE_MAX_DIAS, HORIZONTE_MIN_DIAS, HORIZONTE_PADRAO_DIAS } from '../config/sazonalidade';
import { representanteIdFiltroSchema } from './client.schema';

const MENSAGEM_HORIZONTE = `Horizonte deve ser um número inteiro de dias entre ${HORIZONTE_MIN_DIAS} e ${HORIZONTE_MAX_DIAS}.`;

/**
 * Query dos insights sazonais (UC13) e dos alertas de produção (UC15):
 * `?horizonteDias=` é quantos dias à frente um evento ainda conta como
 * "próximo". Ausente, vale o padrão; parâmetros desconhecidos são ignorados.
 */
export const horizonteQuerySchema = z.object({
  horizonteDias: z.coerce
    .number(MENSAGEM_HORIZONTE)
    .int(MENSAGEM_HORIZONTE)
    .min(HORIZONTE_MIN_DIAS, MENSAGEM_HORIZONTE)
    .max(HORIZONTE_MAX_DIAS, MENSAGEM_HORIZONTE)
    .default(HORIZONTE_PADRAO_DIAS),
});

/**
 * Query dos alertas de produção (UC15): o horizonte e, opcionalmente,
 * `?representanteId=` para restringir à carteira daquele representante.
 */
export const alertasQuerySchema = horizonteQuerySchema.extend({
  representanteId: representanteIdFiltroSchema,
});
