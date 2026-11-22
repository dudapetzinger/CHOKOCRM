/**
 * As visitas do período por trás dos gráficos e indicadores do Painel, para
 * os painéis laterais. A chave é a dos indicadores mais o sufixo "visitas":
 * os quatro blocos que abrem o painel (resultado por representante, ritmo,
 * ranking e indicadores) dividem a mesma consulta, e o segundo painel abre
 * na hora. Quem chama monta o componente só com o painel aberto, e é então
 * que a busca acontece. Sem retry, como `useKpis`.
 */
import { useQuery } from '@tanstack/react-query';
import { chaveDoPeriodo, type Periodo } from '../lib/periodo';
import { buscarVisitasDoPeriodo } from '../services/kpis';

export function useVisitasDoPeriodo(periodo: Periodo, representanteId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', chaveDoPeriodo(periodo), representanteId ?? 'todos', 'visitas'],
    queryFn: () => buscarVisitasDoPeriodo(periodo, representanteId),
    retry: false,
    staleTime: 30 * 1000,
  });
}
