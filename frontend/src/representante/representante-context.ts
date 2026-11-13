import { createContext } from 'react';

/**
 * Representante escolhido pelo gestor no seletor, compartilhado por
 * Clientes, Agenda e Painel. `null` = Todos.
 */
export type RepresentanteContextValue = {
  representanteId: string | null;
  setRepresentanteId: (id: string | null) => void;
};

export const RepresentanteContext = createContext<RepresentanteContextValue | undefined>(undefined);
