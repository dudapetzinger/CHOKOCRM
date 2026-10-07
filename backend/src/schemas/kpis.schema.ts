import { z } from 'zod';
import { PERIODO_PADRAO_DIAS, PERIODOS_DIAS } from '../config/kpis';

const MENSAGEM_PERIODO = 'Período deve ser 30, 90 ou 365 dias.';

/**
 * Query dos indicadores do painel do gestor (UC14): `?periodoDias=` é a janela
 * de análise, em dias, e só aceita os valores de `PERIODOS_DIAS`. Ausente, vale
 * o padrão; parâmetros desconhecidos são ignorados.
 */
export const periodoQuerySchema = z.object({
  periodoDias: z.coerce
    .number(MENSAGEM_PERIODO)
    .int(MENSAGEM_PERIODO)
    .refine((valor) => (PERIODOS_DIAS as readonly number[]).includes(valor), MENSAGEM_PERIODO)
    .default(PERIODO_PADRAO_DIAS),
});
