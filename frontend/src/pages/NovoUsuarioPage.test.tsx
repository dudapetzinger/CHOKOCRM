import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from '../components/ui/sonner';
import { ApiError } from '../services/api';
import { criarUsuario, type Usuario } from '../services/users';
import { NovoUsuarioPage } from './NovoUsuarioPage';

vi.mock('../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/users')>()),
  criarUsuario: vi.fn(),
}));

const CRIADO: Usuario = {
  id: 'r9',
  nome: 'Bruna Lima',
  email: 'bruna@chokolaten.com.br',
  telefone: '(47) 99977-0000',
  role: 'REPRESENTANTE',
  ativo: true,
  criadoEm: '2026-10-18T12:00:00.000Z',
  clientesNaCarteira: 0,
};

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(criarUsuario).mockReset().mockResolvedValue(CRIADO);
});

function renderizar(role: Role = 'GESTOR') {
  const auth = {
    user: { id: 'g1', nome: 'Marina Gestora', email: 'gestor@chokolaten.com.br', telefone: null, role, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/usuarios', '/usuarios/novo']} initialIndex={1}>
          <Routes>
            <Route path="/usuarios/novo" element={<NovoUsuarioPage />} />
            <Route path="/usuarios" element={<p>Lista de usuários</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

/** Um evento de mudança por campo (sem digitar tecla a tecla; ver NovoClientePage.test). */
function preencher(rotulo: string, texto: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: texto } });
}

function preencherTudo({ senha = 'segredo1', confirmacao = senha }: { senha?: string; confirmacao?: string } = {}) {
  preencher('Nome', 'Bruna Lima');
  preencher('E-mail', 'bruna@chokolaten.com.br');
  preencher('Telefone', '(47) 99977-0000');
  preencher('Senha inicial', senha);
  preencher('Confirmação', confirmacao);
}

describe('NovoUsuarioPage', () => {
  it('senha com 5 caracteres mostra "A senha deve ter pelo menos 6 caracteres." e não envia', async () => {
    renderizar();

    preencherTudo({ senha: '12345' });
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(screen.getByText('A senha deve ter pelo menos 6 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha inicial')).toHaveFocus();
    expect(criarUsuario).not.toHaveBeenCalled();
  });

  it('confirmação diferente mostra "As senhas não conferem." e não envia', async () => {
    renderizar();

    preencherTudo({ senha: 'segredo1', confirmacao: 'segredo2' });
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmação')).toHaveAttribute('aria-invalid', 'true');
    expect(criarUsuario).not.toHaveBeenCalled();
  });

  it('exige nome e e-mail válido', async () => {
    renderizar();

    preencher('E-mail', 'bruna');
    preencher('Senha inicial', 'segredo1');
    preencher('Confirmação', 'segredo1');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(screen.getByText('Nome é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('E-mail inválido.')).toBeInTheDocument();
    expect(criarUsuario).not.toHaveBeenCalled();
  });

  it('sucesso volta para /usuarios e avisa "Usuário criado"', async () => {
    renderizar();

    preencherTudo();
    await usuario.click(screen.getByRole('radio', { name: 'Gestor' }));
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('Lista de usuários')).toBeInTheDocument();
    expect(await screen.findByText('Usuário criado')).toBeInTheDocument();
    // Sem o campo de confirmação: o backend recusa campos a mais
    expect(criarUsuario).toHaveBeenCalledWith({
      nome: 'Bruna Lima',
      email: 'bruna@chokolaten.com.br',
      telefone: '(47) 99977-0000',
      role: 'GESTOR',
      senha: 'segredo1',
    });
  });

  it('representante é o papel padrão e telefone vazio não vai', async () => {
    renderizar();

    preencherTudo();
    preencher('Telefone', '   ');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('Lista de usuários')).toBeInTheDocument();
    expect(criarUsuario).toHaveBeenCalledWith({
      nome: 'Bruna Lima',
      email: 'bruna@chokolaten.com.br',
      role: 'REPRESENTANTE',
      senha: 'segredo1',
    });
  });

  it('e-mail repetido (409) aparece junto do campo e fica na tela', async () => {
    vi.mocked(criarUsuario).mockRejectedValue(new ApiError('CONFLICT', 'Já existe um usuário com este e-mail.'));
    renderizar();

    preencherTudo();
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByText('Já existe um usuário com este e-mail.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Lista de usuários')).not.toBeInTheDocument();
  });

  it('outro erro da API aparece como alerta no formulário', async () => {
    vi.mocked(criarUsuario).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();

    preencherTudo();
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
  });

  it('cancelar volta para a lista', async () => {
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByText('Lista de usuários')).toBeInTheDocument();
  });

  it('representante vê "Esta tela é exclusiva do gestor."', () => {
    renderizar('REPRESENTANTE');

    expect(screen.getByRole('alert')).toHaveTextContent('Esta tela é exclusiva do gestor.');
    expect(screen.queryByRole('button', { name: 'Criar usuário' })).not.toBeInTheDocument();
  });
});
