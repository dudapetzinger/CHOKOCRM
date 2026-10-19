/**
 * Estado de servidor das campanhas (spec 7.7): a tela de Campanhas, os
 * selects do check-in e os chips da Agenda leem a mesma chave. Quem cria,
 * altera, exclui ou faz check-in invalida `['campanhas']` (o status e as
 * vendas vinculadas mudam).
 */
import { useQuery } from '@tanstack/react-query';
import { listarCampanhas } from '../services/campaigns';

export function useCampanhas() {
  return useQuery({ queryKey: ['campanhas'], queryFn: listarCampanhas });
}
