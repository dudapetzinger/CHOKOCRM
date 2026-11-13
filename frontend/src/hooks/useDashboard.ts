/**
 * Estado de servidor dos gráficos do Painel, como manda a arquitetura do
 * projeto: os componentes não chamam a API diretamente (ver
 * docs/arquitetura.md). Sem retry, como `useKpis`: erro de
 * rede/indisponibilidade deve aparecer de imediato. O período (`Periodo`) entra
 * nas chaves por `chaveDoPeriodo`.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { chaveDoPeriodo, type Periodo } from '../lib/periodo';
import { listClients } from '../services/clients';
import { buscarKpisPorRepresentante, buscarRelatorio, buscarVendasMensais } from '../services/dashboard';

/**
 * `keepPreviousData`, como `useKpis`: trocar o período ou o representante
 * mantém os gráficos anteriores esmaecidos até os novos chegarem (o formato
 * da resposta é o mesmo nos dois casos).
 */
export function useKpisPorRepresentante(periodo: Periodo, representanteId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'por-representante', chaveDoPeriodo(periodo), representanteId ?? 'todos'],
    queryFn: () => buscarKpisPorRepresentante(periodo, representanteId),
    retry: false,
    placeholderData: keepPreviousData,
  });
}

/**
 * Os meses de vendas do período mudam pouco durante o uso: um minuto de cache
 * poupa o ERP. `keepPreviousData`, como `useKpisPorRepresentante`: trocar o
 * período mantém o gráfico anterior até o novo chegar.
 */
export function useVendasMensais(periodo: Periodo, representanteId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'vendas-mensais', chaveDoPeriodo(periodo), representanteId ?? 'todos'],
    queryFn: () => buscarVendasMensais(periodo, representanteId),
    retry: false,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/**
 * A carteira ativa inteira (sem busca), para o Painel. A tela de Clientes tem
 * as próprias consultas, que trazem também os inativos; o check-in invalida
 * `['clients']` e atualiza todas.
 */
export function useClientesDaCarteira(representanteId?: string) {
  return useQuery({
    queryKey: ['clients', '', representanteId ?? 'todos'],
    queryFn: () => listClients({ representanteId }),
  });
}

/**
 * Relatório da planilha, buscado só ao clicar em "Planilha":
 * uma mutação, não uma consulta, porque cada clique quer os números do
 * momento e nada fica em cache. Sem retry, como o resto do Painel.
 */
export function useRelatorio() {
  return useMutation({
    mutationFn: ({ periodo, representanteId }: { periodo: Periodo; representanteId?: string }) =>
      buscarRelatorio(periodo, representanteId),
    retry: false,
  });
}
