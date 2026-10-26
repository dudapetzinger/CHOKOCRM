/**
 * Estado de servidor dos gráficos do Painel (Etapa 7), como manda a
 * arquitetura do projeto: os componentes não chamam a API diretamente (ver
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

/**
 * Relatório da planilha (spec 7.12), buscado só ao clicar em "Planilha":
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
