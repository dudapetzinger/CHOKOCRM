/**
 * Estado de servidor dos gráficos do Painel do gestor (Etapa 7), como manda a
 * arquitetura do projeto: os componentes não chamam a API diretamente (ver
 * docs/arquitetura.md). Sem retry, como `useKpis`: erro de
 * rede/indisponibilidade deve aparecer de imediato.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listClients } from '../services/clients';
import { buscarKpisPorRepresentante, buscarVendasMensais } from '../services/dashboard';

/**
 * `keepPreviousData`, como `useKpis`: trocar o período ou o representante
 * mantém os gráficos anteriores esmaecidos até os novos chegarem (o formato
 * da resposta é o mesmo nos dois casos).
 */
export function useKpisPorRepresentante(periodoDias: number, representanteId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'por-representante', periodoDias, representanteId ?? 'todos'],
    queryFn: () => buscarKpisPorRepresentante(periodoDias, representanteId),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/** Doze meses de vendas mudam pouco durante o uso: um minuto de cache poupa o ERP. */
export function useVendasMensais(representanteId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'vendas-mensais', representanteId ?? 'todos'],
    queryFn: () => buscarVendasMensais(representanteId),
    retry: false,
    staleTime: 60 * 1000,
  });
}

/**
 * A carteira inteira, com a mesma chave e a mesma busca (sem texto) da tela de
 * Clientes: as duas telas dividem o cache e o check-in, que invalida
 * `['clients']`, atualiza as duas.
 */
export function useClientesDaCarteira(representanteId?: string) {
  return useQuery({
    queryKey: ['clients', '', representanteId ?? 'todos'],
    queryFn: () => listClients({ representanteId }),
  });
}
