import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import type { PeriodoQuery } from '../schemas/kpis.schema';
import { dataCalendario } from './classificacao.service';
import { janelaDoPeriodo, type Janela } from './kpis.regras';

/**
 * Resolve o período pedido na query (dias, datas ou nada) numa `Janela`
 * conferida contra hoje em São Paulo: o fim não pode ser depois de hoje e,
 * com `limiteDias`, a janela não pode passar dele. Sem banco; os erros são
 * `VALIDATION_ERROR` (400), como os do schema.
 */
export function resolverPeriodo(
  query: Pick<PeriodoQuery, 'periodoDias' | 'inicio' | 'fim'>,
  hoje: Date,
  opcoes: { limiteDias?: number } = {},
): Janela {
  const hojeCalendario = dataCalendario(hoje);
  const janela = janelaDoPeriodo(query, hojeCalendario);

  if (janela.fim > hojeCalendario) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 'A data de fim não pode ser depois de hoje.', 400);
  }
  if (opcoes.limiteDias !== undefined && janela.dias > opcoes.limiteDias) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      `O período de visualização é de até ${opcoes.limiteDias} dias; para mais, use a Planilha.`,
      400,
    );
  }

  return janela;
}
