/**
 * Estado de servidor da agenda do dia (UC10, Etapa 4), como manda a
 * arquitetura do projeto: as páginas não chamam a API diretamente (ver
 * docs/arquitetura.md). O representante escolhido pelo gestor (Etapa 7) faz
 * parte da chave; `'todos'` quando não há filtro.
 */
import { useQuery } from '@tanstack/react-query';
import { buscarAgendaDoDia } from '../services/agenda';

export function useAgenda(representanteId?: string) {
  return useQuery({
    queryKey: ['agenda', representanteId ?? 'todos'],
    queryFn: () => buscarAgendaDoDia(representanteId),
  });
}
