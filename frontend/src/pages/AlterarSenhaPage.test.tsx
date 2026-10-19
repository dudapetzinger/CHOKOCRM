import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from '../components/ui/sonner';
import { ApiError } from '../services/api';
import { alterarSenha } from '../services/conta';
import { AlterarSenhaPage } from './AlterarSenhaPage';

vi.mock('../services/conta', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/conta')>()),
  alterarSenha: vi.fn(),
}));

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(alterarSenha).mockReset().mockResolvedValue(undefined);
});

function renderizar(role: Role = 'REPRESENTANTE') {
  const logout = vi.fn();
  const auth = {
    user: { id: 'u1', nome: 'Eduarda Fischer', email: 'eduarda@chokolaten.com.br', telefone: null, role, ativo: true },
    login: vi.fn(),
    logout,
    recarregarUsuario: vi.fn(),
  };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/conta/senha']}>
        <Routes>
          <Route path="/conta/senha" element={<AlterarSenhaPage />} />
          <Route path="/agenda" element={<p>tela da agenda</p>} />
          <Route path="/painel" element={<p>tela do painel</p>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </AuthContext.Provider>,
  );
  return { logout };
}

function preencher(rotulo: string, texto: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: texto } });
}

function preencherTudo({
  atual = 'antiga123',
  nova = 'novinha1',
  confirmacao = nova,
}: { atual?: string; nova?: string; confirmacao?: string } = {}) {
  preencher('Senha atual', atual);
  preencher('Nova senha', nova);
  preencher('Confirmar nova senha', confirmacao);
}

describe('AlterarSenhaPage', () => {
  it('senha atual incorreta (400 da API) aparece junto do campo "Senha atual" e não desloga', async () => {
    vi.mocked(alterarSenha).mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Senha atual incorreta.'));
    const { logout } = renderizar();

    preencherTudo();
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    const campo = screen.getByLabelText('Senha atual');
    expect(await screen.findByText('Senha atual incorreta.')).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Senha atual incorreta.');
    expect(campo).toHaveFocus();
    expect(logout).not.toHaveBeenCalled();
    expect(screen.queryByText('tela da agenda')).not.toBeInTheDocument();
  });

  it('sucesso avisa "Senha alterada" e volta para a tela inicial do papel', async () => {
    renderizar('REPRESENTANTE');

    preencherTudo();
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('tela da agenda')).toBeInTheDocument();
    expect(await screen.findByText('Senha alterada')).toBeInTheDocument();
    expect(alterarSenha).toHaveBeenCalledWith('antiga123', 'novinha1');
  });

  it('gestor volta para o Painel', async () => {
    renderizar('GESTOR');

    preencherTudo();
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('tela do painel')).toBeInTheDocument();
  });

  it('valida no cliente: senha atual, mínimo de 6 e confirmação', async () => {
    renderizar();

    preencherTudo({ atual: '', nova: '12345', confirmacao: '54321' });
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Senha atual é obrigatória.')).toBeInTheDocument();
    expect(screen.getByText('A senha deve ter pelo menos 6 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();
    expect(alterarSenha).not.toHaveBeenCalled();
  });

  it('outro erro aparece como alerta', async () => {
    vi.mocked(alterarSenha).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();

    preencherTudo();
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
  });
});
