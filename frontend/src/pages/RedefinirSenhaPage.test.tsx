import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';
import { ApiError } from '../services/api';
import { redefinirSenha } from '../services/conta';
import { RedefinirSenhaPage } from './RedefinirSenhaPage';

vi.mock('../services/conta', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/conta')>()),
  redefinirSenha: vi.fn(),
}));

const MENSAGEM_LINK_INVALIDO = 'Este link não vale mais. Peça um novo ao gestor.';

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(redefinirSenha).mockReset().mockResolvedValue(undefined);
});

/** Mostra o endereço atual, para conferir que o token saiu da barra de endereço. */
function Endereco() {
  const { pathname, hash } = useLocation();
  return <p data-testid="endereco">{`${pathname}${hash}`}</p>;
}

function renderizar(entrada: string) {
  render(
    <>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route
            path="/redefinir-senha"
            element={
              <>
                <RedefinirSenhaPage />
                <Endereco />
              </>
            }
          />
          <Route path="/login" element={<p>tela de login</p>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </>,
  );
}

function preencher(rotulo: string, texto: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: texto } });
}

describe('RedefinirSenhaPage', () => {
  it('lê o token do fragmento, tira-o do endereço e mostra o logotipo sem a moldura', () => {
    renderizar('/redefinir-senha#tok-abc_123');

    expect(screen.getByTestId('endereco')).toHaveTextContent(/^\/redefinir-senha$/);
    expect(screen.getByRole('img', { name: 'ChokoCRM' })).toHaveAttribute('src', '/logo.svg');
    expect(screen.getByRole('heading', { level: 1, name: 'Redefinir senha' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('sucesso mostra "Senha redefinida. Entre com a nova senha." e leva ao login', async () => {
    renderizar('/redefinir-senha#tok-abc_123');

    preencher('Nova senha', 'novinha1');
    preencher('Confirmar nova senha', 'novinha1');
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(await screen.findByText('Senha redefinida. Entre com a nova senha.')).toBeInTheDocument();
    expect(redefinirSenha).toHaveBeenCalledWith('tok-abc_123', 'novinha1');
  });

  it('link inválido mostra "Este link não vale mais. Peça um novo ao gestor."', async () => {
    vi.mocked(redefinirSenha).mockRejectedValue(new ApiError('VALIDATION_ERROR', MENSAGEM_LINK_INVALIDO));
    renderizar('/redefinir-senha#token-velho');

    preencher('Nova senha', 'novinha1');
    preencher('Confirmar nova senha', 'novinha1');
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_LINK_INVALIDO);
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/login');
  });

  it('sem token no endereço o link já aparece como inválido', () => {
    renderizar('/redefinir-senha');

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LINK_INVALIDO);
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('link novo colado na mesma aba (só o fragmento muda) passa a valer', async () => {
    vi.mocked(redefinirSenha).mockRejectedValueOnce(new ApiError('VALIDATION_ERROR', MENSAGEM_LINK_INVALIDO));
    const navegar: { ir?: (destino: string) => void } = {};
    function Navegador() {
      const navigate = useNavigate();
      navegar.ir = navigate;
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/redefinir-senha#token-velho']}>
        <Routes>
          <Route
            path="/redefinir-senha"
            element={
              <>
                <RedefinirSenhaPage />
                <Navegador />
              </>
            }
          />
          <Route path="/login" element={<p>tela de login</p>} />
        </Routes>
      </MemoryRouter>,
    );

    preencher('Nova senha', 'novinha1');
    preencher('Confirmar nova senha', 'novinha1');
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_LINK_INVALIDO);

    act(() => navegar.ir?.('/redefinir-senha#token-novo'));

    preencher('Nova senha', 'outra123');
    preencher('Confirmar nova senha', 'outra123');
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByText('tela de login')).toBeInTheDocument();
    expect(redefinirSenha).toHaveBeenLastCalledWith('token-novo', 'outra123');
  });

  it('valida mínimo de 6 e confirmação antes de enviar', async () => {
    renderizar('/redefinir-senha#tok');

    preencher('Nova senha', '12345');
    preencher('Confirmar nova senha', '1234');
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(screen.getByText('A senha deve ter pelo menos 6 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('As senhas não conferem.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nova senha')).toHaveFocus();
    expect(redefinirSenha).not.toHaveBeenCalled();
  });

  it('sem internet mantém o formulário e mostra o erro', async () => {
    vi.mocked(redefinirSenha).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar('/redefinir-senha#tok');

    preencher('Nova senha', 'novinha1');
    preencher('Confirmar nova senha', 'novinha1');
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument();
  });
});
