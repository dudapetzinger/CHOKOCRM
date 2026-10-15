/**
 * Guarda o representante escolhido pelo gestor (Etapa 7) para que a escolha
 * valha nas três telas (Clientes, Agenda, Painel). Estado só em memória: ao
 * recarregar a página volta para "Todos" (decisão registrada na Task 8). Ao
 * sair (ou trocar de usuário), também volta para "Todos". Precisa ficar dentro
 * do `AuthProvider`.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/useAuth';
import { RepresentanteContext, type RepresentanteContextValue } from './representante-context';

export function RepresentanteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [representanteId, setRepresentanteId] = useState<string | null>(null);
  const usuarioAtual = user?.id ?? null;
  const [usuarioAnterior, setUsuarioAnterior] = useState(usuarioAtual);

  // Ajuste de estado durante a renderização (padrão do React para "resetar
  // quando uma prop muda"): sem efeito, sem um render com o valor velho.
  if (usuarioAtual !== usuarioAnterior) {
    setUsuarioAnterior(usuarioAtual);
    setRepresentanteId(null);
  }

  const value = useMemo<RepresentanteContextValue>(
    () => ({ representanteId, setRepresentanteId }),
    [representanteId],
  );

  return <RepresentanteContext.Provider value={value}>{children}</RepresentanteContext.Provider>;
}
