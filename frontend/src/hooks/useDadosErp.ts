/**
 * Estado de servidor dos dados do ERP do cliente (UC11, Etapa 5) e do
 * catálogo de produtos, como manda a arquitetura do projeto: as páginas e os
 * componentes não chamam a API diretamente (ver docs/arquitetura.md).
 */
import { useQuery } from '@tanstack/react-query';
import { buscarDadosErp, listarProdutos } from '../services/erp';

/**
 * Sem retry: erro de rede/indisponibilidade deve aparecer de imediato no
 * card, não após tentativas silenciosas.
 */
export function useDadosErp(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['client', clienteId, 'erp'],
    queryFn: () => buscarDadosErp(clienteId!),
    enabled: Boolean(clienteId),
    retry: false,
  });
}

/**
 * Catálogo para o pedido do check-in (spec 7.5). Muda pouco: fica 10 min
 * em cache. Com o retry padrão: sem o catálogo a representante não monta o
 * pedido, então vale tentar de novo antes de mostrar o erro.
 */
export function useProdutos() {
  return useQuery({
    queryKey: ['erp', 'produtos'],
    queryFn: listarProdutos,
    staleTime: 10 * 60 * 1000,
  });
}
