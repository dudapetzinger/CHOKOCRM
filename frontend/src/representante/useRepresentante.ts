import { useContext } from 'react';
import { useAuth } from '../auth/useAuth';
import { RepresentanteContext, type RepresentanteContextValue } from './representante-context';

/** O valor cru do contexto: o id escolhido (`null` = Todos) e quem o troca. */
export function useRepresentante(): RepresentanteContextValue {
  const context = useContext(RepresentanteContext);
  if (!context) {
    throw new Error('useRepresentante precisa ser usado dentro de um RepresentanteProvider.');
  }
  return context;
}

/**
 * O id a mandar para a API como `representanteId`: `undefined` quando o
 * seletor está em Todos ou quando quem usa não é o gestor (para o
 * representante o backend ignora o filtro de qualquer jeito).
 */
export function useRepresentanteSelecionado(): string | undefined {
  const { user } = useAuth();
  const { representanteId } = useRepresentante();
  if (user?.role !== 'GESTOR' || representanteId === null) {
    return undefined;
  }
  return representanteId;
}
