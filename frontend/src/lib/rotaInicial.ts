import type { Role } from '../auth/auth-context';

/**
 * Tela inicial de cada papel (spec 6.5): o gestor abre no Painel; o
 * representante, na Agenda do dia. Vale para `/`, para o login sem página
 * de origem e para endereços que não existem.
 */
export function rotaInicialDoPapel(role: Role): '/painel' | '/agenda' {
  return role === 'GESTOR' ? '/painel' : '/agenda';
}
