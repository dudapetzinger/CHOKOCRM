/**
 * Estado de servidor dos dados do ERP do cliente (UC11, Etapa 5), como manda
 * a arquitetura do projeto: as páginas e os componentes não chamam a API
 * diretamente (ver docs/arquitetura.md). Sem retry: erro de rede/indisponi-
 * bilidade deve aparecer de imediato no card, não após tentativas silenciosas.
 */
import { useQuery } from '@tanstack/react-query';
import { buscarDadosErp } from '../services/erp';

export function useDadosErp(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['client', clienteId, 'erp'],
    queryFn: () => buscarDadosErp(clienteId!),
    enabled: Boolean(clienteId),
    retry: false,
  });
}
