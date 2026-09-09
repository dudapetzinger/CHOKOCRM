import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, setToken, setUnauthorizedHandler } from '../services/api';
import { AuthContext, type UsuarioAutenticado, type AuthContextValue } from './auth-context';

type LoginResposta = {
  token: string;
  user: UsuarioAutenticado;
};

const USER_KEY = 'chokocrm:user';

function lerUsuarioSalvo(): UsuarioAutenticado | null {
  const bruto = localStorage.getItem(USER_KEY);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as UsuarioAutenticado;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UsuarioAutenticado | null>(lerUsuarioSalvo);
  const navigate = useNavigate();

  async function login(email: string, senha: string): Promise<void> {
    const resultado = await api.post<LoginResposta>('/auth/login', { email, senha });
    setToken(resultado.token);
    localStorage.setItem(USER_KEY, JSON.stringify(resultado.user));
    setUser(resultado.user);
  }

  function logout(): void {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  // Token expirado/inválido em qualquer chamada autenticada (ver api.ts):
  // encerra a sessão local e manda de volta para /login.
  useEffect(() => {
    function handleUnauthorized(): void {
      logout();
      navigate('/login', { replace: true });
    }

    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  const value = useMemo<AuthContextValue>(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
