import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from '../services/api';
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
  const queryClient = useQueryClient();

  // Desde a Etapa 7 cada usuário vê só a própria carteira (spec 5.0): o cache
  // de quem saiu não pode aparecer, nem por um instante, para quem entra.
  const login = useCallback(
    async (email: string, senha: string): Promise<UsuarioAutenticado> => {
      const resultado = await api.post<LoginResposta>('/auth/login', { email, senha });
      setToken(resultado.token);
      localStorage.setItem(USER_KEY, JSON.stringify(resultado.user));
      queryClient.clear();
      setUser(resultado.user);
      return resultado.user;
    },
    [queryClient],
  );

  const logout = useCallback((): void => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    queryClient.clear();
    setUser(null);
  }, [queryClient]);

  // Só grava se a sessão que pediu ainda é a mesma: quem saiu (ou entrou com
  // outra conta) enquanto a resposta chegava não ganha o usuário anterior.
  const recarregarUsuario = useCallback(async (): Promise<void> => {
    const token = getToken();
    if (!token) return;
    const atual = await api.get<UsuarioAutenticado>('/auth/me');
    if (getToken() !== token) return;
    localStorage.setItem(USER_KEY, JSON.stringify(atual));
    setUser(atual);
  }, []);

  // Token expirado/inválido em qualquer chamada autenticada (ver api.ts):
  // encerra a sessão local e manda de volta para /login.
  useEffect(() => {
    function handleUnauthorized(): void {
      logout();
      navigate('/login', { replace: true });
    }

    setUnauthorizedHandler(handleUnauthorized);
    return () => setUnauthorizedHandler(null);
  }, [navigate, logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, recarregarUsuario }),
    [user, login, logout, recarregarUsuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
