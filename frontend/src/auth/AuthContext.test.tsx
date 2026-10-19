import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../services/api';
import type { UsuarioAutenticado } from './auth-context';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const SALVO: UsuarioAutenticado = {
  id: 'g1',
  nome: 'Marina Gestora',
  email: 'gestor@chokolaten.com.br',
  telefone: null,
  role: 'GESTOR',
  ativo: true,
};
const ATUAL: UsuarioAutenticado = { ...SALVO, nome: 'Marina Souza', telefone: '(47) 3333-0000' };

/** Mostra o usuário da sessão e expõe as ações do contexto em botões. */
function Sonda() {
  const { user, recarregarUsuario, logout } = useAuth();
  return (
    <>
      <p>{user ? `${user.nome} · ${user.telefone ?? 'sem telefone'}` : 'ninguém'}</p>
      <button type="button" onClick={() => void recarregarUsuario()}>
        recarregar
      </button>
      <button type="button" onClick={logout}>
        sair
      </button>
    </>
  );
}

function renderizar() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthProvider>
          <Sonda />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem('chokocrm:token', 'token-da-marina');
  localStorage.setItem('chokocrm:user', JSON.stringify(SALVO));
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AuthProvider.recarregarUsuario', () => {
  it('lê /auth/me e atualiza o usuário da sessão e o guardado', async () => {
    const usuario = userEvent.setup({ delay: null });
    const get = vi.spyOn(api, 'get').mockResolvedValue(ATUAL);
    renderizar();
    expect(screen.getByText('Marina Gestora · sem telefone')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'recarregar' }));

    expect(await screen.findByText('Marina Souza · (47) 3333-0000')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/auth/me');
    expect(JSON.parse(localStorage.getItem('chokocrm:user') ?? '{}')).toEqual(ATUAL);
  });

  it('não devolve a sessão a quem saiu enquanto a resposta chegava', async () => {
    const usuario = userEvent.setup({ delay: null });
    let responder: (valor: UsuarioAutenticado) => void = () => {};
    vi.spyOn(api, 'get').mockImplementation(() => new Promise((resolver) => (responder = resolver as typeof responder)));
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'recarregar' }));
    await usuario.click(screen.getByRole('button', { name: 'sair' }));
    responder(ATUAL);

    await vi.waitFor(() => expect(screen.getByText('ninguém')).toBeInTheDocument());
    // Dá a vez à continuação do recarregar antes de conferir que nada voltou
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(screen.getByText('ninguém')).toBeInTheDocument();
    expect(localStorage.getItem('chokocrm:user')).toBeNull();
  });
});
