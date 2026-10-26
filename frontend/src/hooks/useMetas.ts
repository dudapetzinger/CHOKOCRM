/**
 * Estado de servidor das metas de visitas e vendas (spec 7.8): o bloco do
 * Painel e o de cada campanha leem `['metas', campanhaId, representanteId,
 * período]` (o período, por `chaveDoPeriodo`; `null` sem período: todas).
 * Quem cria, altera ou exclui uma meta, ou faz check-in, invalida `['metas']`
 * (o realizado muda). `keepPreviousData`, como `useKpis`: trocar o período ou
 * o representante não esvazia o bloco; as metas anteriores ficam até as novas
 * chegarem.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { chaveDoPeriodo } from '../lib/periodo';
import { listarMetas, type FiltroMetas } from '../services/goals';

export function useMetas({ campanhaId, representanteId, periodo }: FiltroMetas) {
  return useQuery({
    queryKey: ['metas', campanhaId ?? null, representanteId ?? null, periodo ? chaveDoPeriodo(periodo) : null],
    queryFn: () => listarMetas({ campanhaId, representanteId, periodo }),
    placeholderData: keepPreviousData,
  });
}
