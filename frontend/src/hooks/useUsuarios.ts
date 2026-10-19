/**
 * Estado de servidor da tela de Usuários (Etapa 8). Só busca para o gestor
 * (o endpoint é restrito a ele).
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { listarUsuarios } from '../services/users';

export function useUsuarios() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
    enabled: user?.role === 'GESTOR',
  });
}
