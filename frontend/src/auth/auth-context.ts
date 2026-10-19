import { createContext } from 'react';

export type Role = 'REPRESENTANTE' | 'GESTOR';

/** O usuário da sessão, como o login e `GET /auth/me` o devolvem. */
export type UsuarioAutenticado = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: Role;
  ativo: boolean;
};

export type AuthContextValue = {
  user: UsuarioAutenticado | null;
  /** Entra e devolve o usuário (o login usa o papel para escolher a tela inicial). */
  login: (email: string, senha: string) => Promise<UsuarioAutenticado>;
  logout: () => void;
  /**
   * Relê o usuário da sessão (`GET /auth/me`) e atualiza o menu da conta,
   * depois que os dados dele mudaram (ex.: o gestor editou o próprio nome).
   */
  recarregarUsuario: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
