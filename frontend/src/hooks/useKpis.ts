/**
 * Estado de servidor dos indicadores do painel do gestor (UC14, Etapa 6C),
 * como manda a arquitetura do projeto: os componentes não chamam a API
 * diretamente (ver docs/arquitetura.md). O período e o representante escolhido
 * pelo gestor (Etapa 7; `'todos'` sem filtro) fazem parte da chave (o período,
 * inclusive o personalizado da Etapa 9, por `chaveDoPeriodo`): cada
 * combinação tem seu próprio cache. Sem retry, como `useInsights`: erro de
 * rede/indisponibilidade deve aparecer de imediato.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { chaveDoPeriodo, type Periodo } from '../lib/periodo';
import { buscarKpis } from '../services/kpis';

/** `keepPreviousData`: trocar o período não esvazia o card; o resultado anterior fica esmaecido até o novo chegar. */
export function useKpis(periodo: Periodo, representanteId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', chaveDoPeriodo(periodo), representanteId ?? 'todos'],
    queryFn: () => buscarKpis(periodo, representanteId),
    retry: false,
    placeholderData: keepPreviousData,
  });
}
