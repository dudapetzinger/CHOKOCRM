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
  /** Entra e devolve o usuário (o login usa o papel para escolher a tela inicial). */
  login: (email: string, senha: string) => Promise<UsuarioAutenticado>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
