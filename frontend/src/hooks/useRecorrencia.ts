/**
 * Estado de servidor da alteração de recorrência de visitas (UC09,
 * Etapa 4), como manda a arquitetura do projeto: páginas e componentes não
 * chamam a API diretamente (ver docs/arquitetura.md e `hooks/useVisitas.ts`).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alterarRecorrencia } from '../services/clients';

export function useAlterarRecorrencia(clienteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { recorrenciaDias: number; justificativa: string }) =>
      alterarRecorrencia(clienteId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}
