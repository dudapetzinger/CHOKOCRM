/**
 * Estado de servidor da agenda do dia (UC10, Etapa 4), como manda a
 * arquitetura do projeto: as páginas não chamam a API diretamente (ver
 * docs/arquitetura.md).
 */
import { useQuery } from '@tanstack/react-query';
import { buscarAgendaDoDia } from '../services/agenda';

export function useAgenda() {
  return useQuery({
    queryKey: ['agenda'],
    queryFn: buscarAgendaDoDia,
  });
}
