import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../auth/auth-context';
import { ApiError } from '../services/api';
import { LoginPage } from './LoginPage';

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
});

function renderizar(login: (email: string, senha: string) => Promise<void>) {
  const auth = { user: null, login, logout: vi.fn() };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/clientes" element={<p>lista</p>} />
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
    expect(screen.queryByText('lista')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
  });

  it('erro que não vem da API mostra a mensagem padrão', async () => {
    renderizar(vi.fn().mockRejectedValue(new TypeError('boom')));

    await preencherEEnviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar. Tente novamente.');
  });

  it('login com sucesso chama o serviço com e-mail e senha e leva para /clientes', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderizar(login);

    await preencherEEnviar('ana@chokolaten.com.br', 'segredo123');

    expect(await screen.findByText('lista')).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith('ana@chokolaten.com.br', 'segredo123');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('um novo envio limpa a mensagem de erro anterior', async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('UNAUTHORIZED', 'E-mail ou senha inválidos'))
      .mockResolvedValueOnce(undefined);
    renderizar(login);

    await preencherEEnviar();
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('lista')).toBeInTheDocument();
    expect(screen.queryByText('E-mail ou senha inválidos')).not.toBeInTheDocument();
  });
});
