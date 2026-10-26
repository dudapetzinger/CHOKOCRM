import { z } from 'zod';
import { PERIODOS_DIAS } from '../config/kpis';

/**
 * O período de análise nas queries (UC14, spec 7.8 e 7.12): em dias
 * (`?periodoDias=`, só os valores de `PERIODOS_DIAS`) ou por datas
 * (`?inicio=&fim=`, 'AAAA-MM-DD'), nunca os dois; sem nenhum, vale o padrão.
 * Os indicadores, o relatório e a lista de metas compõem os campos daqui
 * com os seus. O teto de dias e "fim não depois de hoje" dependem da data
 * de hoje e ficam em `resolverPeriodo` (services/periodo.ts).
 */

const MENSAGEM_PERIODO = 'Período deve ser 30, 90 ou 365 dias.';
const MENSAGEM_DIAS_OU_DATAS = 'Informe o período em dias ou por datas, não os dois.';
const MENSAGEM_INICIO_E_FIM = 'Informe o início e o fim do período.';
const MENSAGEM_FIM_ANTES_DO_INICIO = 'A data de fim deve ser depois do início.';

/** Os três campos do período, sem valor padrão: ausentes, `janelaDoPeriodo` aplica os 30 dias. */
export const camposDoPeriodo = {
  periodoDias: z.coerce
    .number(MENSAGEM_PERIODO)
    .int(MENSAGEM_PERIODO)
    .refine((valor) => (PERIODOS_DIAS as readonly number[]).includes(valor), MENSAGEM_PERIODO)
    .optional(),
  inicio: z.iso.date({ error: 'Data de início inválida.' }).optional(),
  fim: z.iso.date({ error: 'Data de fim inválida.' }).optional(),
};

/** As regras entre os campos do período: dias ou datas (não os dois), as duas datas juntas e fim não antes do início. */
export function validarPeriodo(
  periodo: { periodoDias?: number | undefined; inicio?: string | undefined; fim?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  const temData = periodo.inicio !== undefined || periodo.fim !== undefined;

  if (periodo.periodoDias !== undefined && temData) {
    ctx.addIssue({ code: 'custom', message: MENSAGEM_DIAS_OU_DATAS, path: ['periodoDias'] });
  } else if ((periodo.inicio === undefined) !== (periodo.fim === undefined)) {
    ctx.addIssue({
      code: 'custom',
      message: MENSAGEM_INICIO_E_FIM,
      path: [periodo.inicio === undefined ? 'inicio' : 'fim'],
    });
  } else if (periodo.inicio !== undefined && periodo.fim !== undefined && periodo.fim < periodo.inicio) {
    ctx.addIssue({ code: 'custom', message: MENSAGEM_FIM_ANTES_DO_INICIO, path: ['fim'] });
  }
}
