/**
 * Estado de servidor dos lembretes (Etapa 9), como manda a arquitetura do
 * projeto: as páginas não chamam a API diretamente (ver
 * docs/arquitetura.md). A ficha lê os abertos do cliente; a agenda do dia os
 * recebe em `['agenda']`. Concluir invalida as duas chaves, para o lembrete
 * sumir de onde estiver, e avisa num toast.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mensagemErroApi } from '../services/clients';
import { concluirLembrete, listarLembretesDoCliente } from '../services/lembretes';

export function useLembretesDoCliente(clienteId?: string) {
  return useQuery({
    queryKey: ['lembretes', clienteId],
    queryFn: () => listarLembretesDoCliente(clienteId!),
    enabled: Boolean(clienteId),
  });
}

export function useConcluirLembrete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => concluirLembrete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['lembretes'] });
      toast.success('Lembrete concluído');
    },
    onError: (erro) => {
      toast.error(mensagemErroApi(erro, 'Não foi possível concluir o lembrete.'));
    },
  });
}
