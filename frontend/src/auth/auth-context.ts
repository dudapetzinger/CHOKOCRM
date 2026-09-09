import { createContext } from 'react';

export type Role = 'REPRESENTANTE' | 'GESTOR';

export type UsuarioAutenticado = {
  id: string;
  nome: string;
  email: string;
  role: Role;
};

export type AuthContextValue = {
  user: UsuarioAutenticado | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
