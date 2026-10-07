/**
 * Estado de servidor dos indicadores do painel do gestor (UC14, Etapa 6C),
 * como manda a arquitetura do projeto: os componentes não chamam a API
 * diretamente (ver docs/arquitetura.md). O período faz parte da chave: cada
 * período tem seu próprio cache. Sem retry, como `useInsights`: erro de
 * rede/indisponibilidade deve aparecer de imediato.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { buscarKpis } from '../services/kpis';

/** `keepPreviousData`: trocar o período não esvazia o card; o resultado anterior fica esmaecido até o novo chegar. */
export function useKpis(periodoDias: number) {
  return useQuery({
    queryKey: ['dashboard', 'kpis', periodoDias],
    queryFn: () => buscarKpis(periodoDias),
    retry: false,
    placeholderData: keepPreviousData,
  });
}
