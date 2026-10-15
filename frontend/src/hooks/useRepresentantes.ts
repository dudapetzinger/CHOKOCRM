/**
 * Estado de servidor da lista de representantes (Etapa 7), usada pelo
 * seletor do gestor. Só busca para o gestor (o endpoint é restrito a ele) e
 * guarda por 5 minutos: a lista quase nunca muda durante o uso.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { listRepresentantes } from '../services/users';

export function useRepresentantes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['users', 'representantes'],
    queryFn: listRepresentantes,
    enabled: user?.role === 'GESTOR',
    staleTime: 5 * 60 * 1000,
  });
}
