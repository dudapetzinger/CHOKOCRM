import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, type InitialEntry } from 'react-router-dom';
import { AuthContext, type UsuarioAutenticado } from '../auth/auth-context';
import { ApiError } from '../services/api';
import { LoginPage } from './LoginPage';

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
});

const GESTOR: UsuarioAutenticado = { id: 'g1', nome: 'Marina Gestora', email: 'gestor@chokolaten.com.br', role: 'GESTOR' };
const REPRESENTANTE: UsuarioAutenticado = {
  id: 'r1',
  nome: 'Ana Representante',
  email: 'ana@chokolaten.com.br',
  role: 'REPRESENTANTE',
};

function renderizar(
  login: (email: string, senha: string) => Promise<UsuarioAutenticado>,
  entrada: InitialEntry = '/login',
) {
  const auth = { user: null, login, logout: vi.fn() };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/painel" element={<p>painel</p>} />
          <Route path="/agenda" element={<p>agenda</p>} />
          <Route path="/clientes/:id" element={<p>ficha do cliente</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

async function preencherEEnviar(email = 'ana@chokolaten.com.br', senha = 'segredo123') {
  await usuario.type(screen.getByLabelText('E-mail'), email);
  await usuario.type(screen.getByLabelText('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  it('credenciais erradas (401 da API) mostram "E-mail ou senha inválidos" e ficam na tela de login', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError('UNAUTHORIZED', 'E-mail ou senha inválidos'));
    renderizar(login);

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos');
    expect(screen.queryByText('painel')).not.toBeInTheDocument();
    expect(screen.queryByText('agenda')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('erro que não vem da API mostra a mensagem padrão', async () => {
    renderizar(vi.fn().mockRejectedValue(new TypeError('boom')));

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar. Tente novamente.');
  });

  it('login do gestor chama o serviço com e-mail e senha e leva para /painel', async () => {
    const login = vi.fn().mockResolvedValue(GESTOR);
    renderizar(login);

    await preencherEEnviar('gestor@chokolaten.com.br', 'segredo123');

    expect(await screen.findByText('painel')).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith('gestor@chokolaten.com.br', 'segredo123');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('depois do login do representante vai para /agenda', async () => {
    renderizar(vi.fn().mockResolvedValue(REPRESENTANTE));

    await preencherEEnviar();

    expect(await screen.findByText('agenda')).toBeInTheDocument();
  });

  it('quem chegou pedindo uma tela protegida volta para ela depois do login', async () => {
    renderizar(vi.fn().mockResolvedValue(REPRESENTANTE), {
      pathname: '/login',
      state: { from: { pathname: '/clientes/c1', search: '', hash: '' } },
    });

    await preencherEEnviar();

    expect(await screen.findByText('ficha do cliente')).toBeInTheDocument();
  });

  it('mostra o logotipo, o slogan e o título "Entrar"', () => {
    renderizar(vi.fn());

    expect(screen.getByRole('img', { name: 'ChokoCRM' })).toHaveAttribute('src', '/logo.svg');
    expect(screen.getByText('Gestão de visitas para representantes comerciais')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
  });

  it('não mostra dica de contas de teste', () => {
    renderizar(vi.fn());

    expect(screen.queryByText(/chokolaten\.com\.br/)).not.toBeInTheDocument();
    expect(screen.queryByText(/qualquer senha/i)).not.toBeInTheDocument();
  });

  it('um novo envio limpa a mensagem de erro anterior', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'E-mail ou senha inválidos'))
      .mockResolvedValueOnce(REPRESENTANTE);
    renderizar(login);

    await preencherEEnviar();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('agenda')).toBeInTheDocument();
    expect(screen.queryByText('E-mail ou senha inválidos')).not.toBeInTheDocument();
  });
});
