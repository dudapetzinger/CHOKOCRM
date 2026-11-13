/**
 * Estado de servidor da agenda do dia, como manda a arquitetura do projeto:
 * as páginas não chamam a API diretamente (ver docs/arquitetura.md). O
 * representante escolhido pelo gestor faz parte da chave; `'todos'` quando
 * não há filtro.
 */
import { useQuery } from '@tanstack/react-query';
import { buscarAgendaDoDia } from '../services/agenda';

export function useAgenda(representanteId?: string) {
  return useQuery({
    queryKey: ['agenda', representanteId ?? 'todos'],
    queryFn: () => buscarAgendaDoDia(representanteId),
  });
}
