/**
 * Estado de servidor do calendário da Agenda (spec 7.6), por mês e pelo
 * representante escolhido pelo gestor (`'todos'` sem filtro), como
 * `useAgenda`. A chave começa por `'agenda'`: quem invalida a agenda (check-in,
 * troca de recorrência) também renova o calendário.
 */
import { useQuery } from '@tanstack/react-query';
import { buscarCalendario } from '../services/agenda';

export function useCalendario(mes: string, representanteId?: string) {
  return useQuery({
    queryKey: ['agenda', 'calendario', mes, representanteId ?? 'todos'],
    queryFn: () => buscarCalendario(mes, representanteId),
  });
}
