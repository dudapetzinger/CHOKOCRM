import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type Role } from '../auth/auth-context';
import { RepresentanteProvider } from '../representante/RepresentanteContext';
import { useRepresentante } from '../representante/useRepresentante';
import { SeletorRepresentante } from './SeletorRepresentante';

vi.mock('../services/users', () => ({
  listRepresentantes: vi.fn().mockResolvedValue([
    { id: 'u1', nome: 'Eduarda Fischer' },
    { id: 'u2', nome: 'Rafael Schmitt' },
  ]),
}));

function Sonda() {
  const { representanteId } = useRepresentante();
  return <p data-testid="sonda">{representanteId ?? 'nenhum'}</p>;
}

function renderizarComo(role: Role, children: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth = {
    user: { id: 'g1', nome: 'Gestor', email: 'gestor@exemplo.com', role },
    login: vi.fn(),
    logout: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RepresentanteProvider>{children}</RepresentanteProvider>
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('SeletorRepresentante', () => {
  it('para o gestor, mostra "Todos" e o primeiro nome de cada representante', async () => {
    renderizarComo('GESTOR', <SeletorRepresentante />);

    expect(screen.getByRole('group', { name: 'Filtrar por representante' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('button', { name: 'Eduarda' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Rafael' })).toBeInTheDocument();
  });

  it('clicar em "Rafael" muda o representante escolhido no contexto; "Todos" volta para nenhum', async () => {
    renderizarComo(
      'GESTOR',
      <>
        <SeletorRepresentante />
        <Sonda />
      </>,
    );

    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');

    await userEvent.click(await screen.findByRole('button', { name: 'Rafael' }));

    expect(screen.getByTestId('sonda')).toHaveTextContent('u2');
    expect(screen.getByRole('button', { name: 'Rafael' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Todos' }));

    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');
  });

  it('para o representante, não renderiza nada', () => {
    const { container } = renderizarComo('REPRESENTANTE', <SeletorRepresentante />);

    expect(container).toBeEmptyDOMElement();
  });
});
