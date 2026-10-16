/**
 * Estado de servidor dos gráficos do Painel do gestor (Etapa 7), como manda a
 * arquitetura do projeto: os componentes não chamam a API diretamente (ver
 * docs/arquitetura.md). Sem retry, como `useKpis`: erro de
 * rede/indisponibilidade deve aparecer de imediato.
 */
import { useQuery } from '@tanstack/react-query';
import { listClients } from '../services/clients';
import { buscarKpisPorRepresentante, buscarVendasMensais } from '../services/dashboard';

/**
 * Trocar o período mantém o gráfico anterior esmaecido até o novo chegar; trocar
 * o representante não, porque o formato muda (por representante ↔ por semana).
 */
export function useKpisPorRepresentante(periodoDias: number, representanteId?: string) {
  const representante = representanteId ?? 'todos';
  return useQuery({
    queryKey: ['dashboard', 'por-representante', periodoDias, representante],
    queryFn: () => buscarKpisPorRepresentante(periodoDias, representanteId),
    retry: false,
    placeholderData: (dadosAnteriores, consultaAnterior) =>
      consultaAnterior?.queryKey[3] === representante ? dadosAnteriores : undefined,
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
