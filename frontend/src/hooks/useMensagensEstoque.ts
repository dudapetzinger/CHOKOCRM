/**
 * Estado de servidor da mensagem de consulta de estoque (UC12, Etapa 6A),
 * como manda a arquitetura do projeto: páginas e componentes não chamam a
 * API diretamente (ver docs/arquitetura.md).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gerarMensagem, listarMensagens } from '../services/stockMessages';

export function useMensagensEstoque(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['client', clienteId, 'stock-messages'],
    queryFn: () => listarMensagens(clienteId!),
    enabled: Boolean(clienteId),
  });
}

export function useGerarMensagemEstoque(clienteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { texto: string; contactId?: string }) => gerarMensagem(clienteId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clienteId, 'stock-messages'] });
    },
  });
}
