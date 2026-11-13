/**
 * Estado de servidor das visitas encapsulado em hooks com TanStack Query,
 * como manda a arquitetura do projeto: as páginas e os componentes não
 * chamam a API diretamente (ver docs/arquitetura.md).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buscarFoto, editarVisita, enviarFoto, listarVisitas } from '../services/visits';
import type { ResultadoVisita, Visita } from '../services/visits';

type DadosDaEdicao = { descricao?: string; resultado?: ResultadoVisita };

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

export function useEditarVisita(clienteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitaId, dados }: { visitaId: string; dados: DadosDaEdicao }): Promise<Visita> =>
      editarVisita(visitaId, dados),
    onSuccess: () => {
      // A cor do cliente depende do resultado da última visita, então a ficha,
      // a lista, a agenda, as campanhas, as metas e o painel também mudam.
      queryClient.invalidateQueries({ queryKey: chaveDasVisitas(clienteId) });
      queryClient.invalidateQueries({ queryKey: ['client', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      queryClient.invalidateQueries({ queryKey: ['metas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
 * <img> não manda header; por isso a imagem vem como Blob e o componente
 * transforma em `blob:` URL.
 */
export function useVisitaFoto(visitaId: string) {
  return useQuery({
    queryKey: ['visita-foto', visitaId],
    queryFn: () => buscarFoto(visitaId),
    retry: false,
  });
}
