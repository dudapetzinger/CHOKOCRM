/**
 * Estado de servidor das visitas (UC07/UC08) encapsulado em hooks com
 * TanStack Query, como manda a arquitetura do projeto: as páginas e os
 * componentes não chamam a API diretamente (ver docs/arquitetura.md).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buscarFoto, editarDescricao, enviarFoto, listarVisitas } from '../services/visits';
import type { Visita } from '../services/visits';

function chaveDasVisitas(clienteId: string | undefined) {
  return ['client', clienteId, 'visits'];
}

export function useVisitas(clienteId: string | undefined) {
  return useQuery({
    queryKey: chaveDasVisitas(clienteId),
    queryFn: () => listarVisitas(clienteId!),
    enabled: Boolean(clienteId),
  });
}

export function useEditarDescricaoVisita(clienteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitaId, descricao }: { visitaId: string; descricao: string }): Promise<Visita> =>
      editarDescricao(visitaId, descricao),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaveDasVisitas(clienteId) });
    },
  });
}

export function useAnexarFotoVisita(clienteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitaId, foto }: { visitaId: string; foto: Blob }): Promise<void> =>
      enviarFoto(visitaId, foto),
    onSuccess: (_resultado, { visitaId }) => {
      queryClient.invalidateQueries({ queryKey: chaveDasVisitas(clienteId) });
      queryClient.invalidateQueries({ queryKey: ['visita-foto', visitaId] });
    },
  });
}

/**
 * Busca os bytes da foto. A rota exige o header `Authorization`, e uma tag
 * <img> não manda header — por isso a imagem vem como Blob e o componente
 * transforma em `blob:` URL.
 */
export function useVisitaFoto(visitaId: string) {
  return useQuery({
    queryKey: ['visita-foto', visitaId],
    queryFn: () => buscarFoto(visitaId),
    retry: false,
  });
}
