/**
 * Estado de servidor das metas de visitas e vendas (spec 7.8): o bloco do
 * Painel e o de cada campanha leem `['metas', campanhaId, representanteId]`.
 * Quem cria, altera ou exclui uma meta, ou faz check-in, invalida `['metas']`
 * (o realizado muda).
 */
import { useQuery } from '@tanstack/react-query';
import { listarMetas, type FiltroMetas } from '../services/goals';

export function useMetas({ campanhaId, representanteId }: FiltroMetas) {
  return useQuery({
    queryKey: ['metas', campanhaId ?? null, representanteId ?? null],
    queryFn: () => listarMetas({ campanhaId, representanteId }),
  });
}
