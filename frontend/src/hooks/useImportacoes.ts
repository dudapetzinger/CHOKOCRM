/**
 * Estado de servidor da importação de notas (Etapa 12b), dos CNPJs sem
 * cliente (de onde o gestor cria o cliente pela nota) e da situação da fonte
 * de vendas do ERP, que qualquer papel lê para o aviso das telas.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { buscarSituacaoErp } from '../services/erp';
import { listarImportacoes, listarPendencias, listarSemCliente } from '../services/importacoes';

/** Situação do ERP (simulado × importado, última venda). Muda pouco: 60 s em cache. */
export function useSituacaoErp() {
  return useQuery({
    queryKey: ['erp', 'situacao'],
    queryFn: buscarSituacaoErp,
    staleTime: 60 * 1000,
  });
}

/** Últimas importações do gestor. */
export function useImportacoes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['erp', 'importacoes'],
    queryFn: listarImportacoes,
    enabled: user?.role === 'GESTOR',
  });
}

/** Notas sem vínculo definido, à espera da decisão do gestor. */
export function usePendencias() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['erp', 'pendencias'],
    queryFn: listarPendencias,
    enabled: user?.role === 'GESTOR',
  });
}

/** CNPJs das notas sem cliente no CRM, à espera de o gestor criar o cliente. */
export function useSemCliente() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['erp', 'sem-cliente'],
    queryFn: listarSemCliente,
    enabled: user?.role === 'GESTOR',
  });
}
