import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext, type UsuarioAutenticado } from '../auth/auth-context';
import { RepresentanteProvider } from './RepresentanteContext';
import { useRepresentante } from './useRepresentante';

const GESTOR: UsuarioAutenticado = { id: 'g1', nome: 'Gestor', email: 'gestor@exemplo.com', role: 'GESTOR' };
const OUTRO_GESTOR: UsuarioAutenticado = { id: 'g2', nome: 'Outro', email: 'outro@exemplo.com', role: 'GESTOR' };

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
});

function Sonda() {
  const { representanteId, setRepresentanteId } = useRepresentante();
  return (
    <>
      <p data-testid="sonda">{representanteId ?? 'nenhum'}</p>
      <button type="button" onClick={() => setRepresentanteId('r2')}>
        Escolher r2
      </button>
    </>
  );
}

function Harness({ usuario, children }: { usuario: UsuarioAutenticado | null; children: ReactNode }) {
  // Objeto novo a cada render, como o AuthProvider real faz ao recalcular o value.
  const auth = { user: usuario, login: vi.fn(), logout: vi.fn() };
  return (
    <AuthContext.Provider value={auth}>
      <RepresentanteProvider>{children}</RepresentanteProvider>
    </AuthContext.Provider>
  );
}

describe('RepresentanteProvider', () => {
  it('começa em "nenhum" (Todos) e guarda a escolha', async () => {
    render(
      <Harness usuario={GESTOR}>
        <Sonda />
      </Harness>,
    );
    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');

    await usuario.click(screen.getByRole('button', { name: 'Escolher r2' }));

    expect(screen.getByTestId('sonda')).toHaveTextContent('r2');
  });

  it('um novo render com o mesmo usuário mantém a escolha', async () => {
    const { rerender } = render(
      <Harness usuario={GESTOR}>
        <Sonda />
      </Harness>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Escolher r2' }));

    rerender(
      <Harness usuario={{ ...GESTOR }}>
        <Sonda />
      </Harness>,
    );

    expect(screen.getByTestId('sonda')).toHaveTextContent('r2');
  });

  it('sair (usuário vira null) volta para "nenhum"', async () => {
    const { rerender } = render(
      <Harness usuario={GESTOR}>
        <Sonda />
      </Harness>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Escolher r2' }));
    expect(screen.getByTestId('sonda')).toHaveTextContent('r2');

    rerender(
      <Harness usuario={null}>
        <Sonda />
      </Harness>,
    );

    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');
  });

  it('entrar com outro usuário não herda a escolha do anterior', async () => {
    const { rerender } = render(
      <Harness usuario={GESTOR}>
        <Sonda />
      </Harness>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Escolher r2' }));

    rerender(
      <Harness usuario={OUTRO_GESTOR}>
        <Sonda />
      </Harness>,
    );

    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');
  });

  it('useRepresentante fora do provider lança um erro claro', () => {
    // O React registra no console o erro lançado durante a renderização.
    const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Sonda />)).toThrow('useRepresentante precisa ser usado dentro de um RepresentanteProvider.');
    } finally {
      consoleErro.mockRestore();
    }
  });
});
