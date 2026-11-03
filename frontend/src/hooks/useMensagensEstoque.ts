/**
 * Estado de servidor da mensagem de consulta de estoque (UC12, Etapa 6A),
 * como manda a arquitetura do projeto: páginas e componentes não chamam a
 * API diretamente (ver docs/arquitetura.md).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buscarProposta, gerarMensagem, listarMensagens } from '../services/stockMessages';

export function useMensagensEstoque(clienteId: string | undefined) {
  return useQuery({
    queryKey: ['client', clienteId, 'stock-messages'],
    queryFn: () => listarMensagens(clienteId!),
    enabled: Boolean(clienteId),
  });
}

/**
 * Proposta da mensagem (texto sugerido, contatos, evento vigente), buscada
 * só quando `habilitado` — o cabeçalho da ficha a usa para abrir o WhatsApp
 * já com a mensagem. Fica fresca por 5 minutos e não repete em caso de erro
 * (o link volta a levar só o número).
 */
export function usePropostaDeMensagem(clienteId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['client', clienteId, 'stock-message', 'proposta'],
    queryFn: () => buscarProposta(clienteId!),
    enabled: Boolean(clienteId) && habilitado,
    staleTime: 5 * 60 * 1000,
    retry: false,
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
