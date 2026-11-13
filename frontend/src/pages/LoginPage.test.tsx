import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, type InitialEntry } from 'react-router-dom';
import { AuthContext, type UsuarioAutenticado } from '../auth/auth-context';
import { ApiError } from '../services/api';
import { definirDeslocamento } from '../lib/relogio';
import { buscarRelogio, type Relogio } from '../services/sistema';
import { LoginPage } from './LoginPage';

vi.mock('../services/sistema', () => ({
  buscarRelogio: vi.fn(),
  definirDemonstracao: vi.fn(),
}));

const RELOGIO_REAL: Relogio = {
  agora: '2026-11-09T15:00:00.000Z',
  simulado: false,
  dataDeDemonstracao: null,
  deslocamentoDias: 0,
};

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(buscarRelogio).mockReset().mockResolvedValue(RELOGIO_REAL);
});

afterEach(() => {
  definirDeslocamento(0);
});

const GESTOR: UsuarioAutenticado = {
  id: 'g1',
  nome: 'Marina Gestora',
  usuario: 'gestao',
  telefone: null,
  role: 'GESTOR',
  ativo: true,
};
const REPRESENTANTE: UsuarioAutenticado = {
  id: 'r1',
  nome: 'Ana Representante',
  usuario: 'ana',
  telefone: '(47) 99900-0000',
  role: 'REPRESENTANTE',
  ativo: true,
};

function renderizar(
  login: (usuario: string, senha: string) => Promise<UsuarioAutenticado>,
  entrada: InitialEntry = '/login',
) {
  const auth = { user: null, login, logout: vi.fn(), recarregarUsuario: vi.fn(async () => {}) };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[entrada]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/painel" element={<p>painel</p>} />
            <Route path="/agenda" element={<p>agenda</p>} />
            <Route path="/clientes/:id" element={<p>ficha do cliente</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

async function preencherEEnviar(conta = 'ana', senha = 'segredo123') {
  await usuario.type(screen.getByLabelText('Usuário'), conta);
  await usuario.type(screen.getByLabelText('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  it('credenciais erradas (401 da API) mostram "Usuário ou senha inválidos" e ficam na tela de login', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError('UNAUTHORIZED', 'Usuário ou senha inválidos'));
    renderizar(login);

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha inválidos');
    expect(screen.queryByText('painel')).not.toBeInTheDocument();
    expect(screen.queryByText('agenda')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('conta inativa (403 da API) mostra "Conta inativa. Fale com o gestor." e fica na tela de login', async () => {
    const login = vi.fn().mockRejectedValue(new ApiError('FORBIDDEN', 'Conta inativa. Fale com o gestor.'));
    renderizar(login);

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Conta inativa. Fale com o gestor.');
    expect(screen.queryByText('agenda')).not.toBeInTheDocument();
  });

  it('erro que não vem da API mostra a mensagem padrão', async () => {
    renderizar(vi.fn().mockRejectedValue(new TypeError('boom')));

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar. Tente novamente.');
  });

  it('login do gestor chama o serviço com usuário e senha e leva para /painel', async () => {
    const login = vi.fn().mockResolvedValue(GESTOR);
    renderizar(login);

    await preencherEEnviar('gestao', 'segredo123');

    expect(await screen.findByText('painel')).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith('gestao', 'segredo123');
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

  it('o campo "Usuário" é de texto, sem maiúscula automática nem corretor, e serve ao gerenciador de senhas', () => {
    renderizar(vi.fn());

    const campo = screen.getByLabelText('Usuário');
    expect(campo).toHaveAttribute('type', 'text');
    expect(campo).toHaveAttribute('autocomplete', 'username');
    expect(campo).toHaveAttribute('autocapitalize', 'none');
    expect(campo).toHaveAttribute('autocorrect', 'off');
    expect(campo).toHaveAttribute('spellcheck', 'false');
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
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
      .mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'Usuário ou senha inválidos'))
      .mockResolvedValueOnce(REPRESENTANTE);
    renderizar(login);

    await preencherEEnviar();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('agenda')).toBeInTheDocument();
    expect(screen.queryByText('Usuário ou senha inválidos')).not.toBeInTheDocument();
  });

  it('no topo, antes do logotipo, o botão discreto "Modo demonstração" abre o painel', async () => {
    renderizar(vi.fn());

    const botao = await screen.findByRole('button', { name: 'Modo demonstração' });
    const logotipo = screen.getByRole('img', { name: 'ChokoCRM' });
    expect(botao.compareDocumentPosition(logotipo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await usuario.click(botao);

    expect(screen.getByRole('dialog', { name: 'Modo demonstração' })).toBeInTheDocument();
  });

  it('com a data da demonstração ativa, o topo mostra a faixa com "alterar"', async () => {
    vi.mocked(buscarRelogio).mockResolvedValue({
      agora: '2027-03-15T15:00:00.000Z',
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      diaDeReferencia: '2026-11-09',
      deslocamentoDias: 126,
    });
    renderizar(vi.fn());

    expect(await screen.findByRole('status')).toHaveTextContent('Modo demonstração · 15/03/2027');
    expect(screen.getByRole('button', { name: 'alterar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modo demonstração' })).not.toBeInTheDocument();
  });
});
