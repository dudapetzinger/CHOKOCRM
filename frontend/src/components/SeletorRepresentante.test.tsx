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
    user: { id: 'g1', nome: 'Gestor', email: 'gestor@exemplo.com', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
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
  it('para o gestor, é um select com "Todos os representantes" e o nome completo de cada representante', async () => {
    renderizarComo('GESTOR', <SeletorRepresentante />);

    const select = screen.getByRole('combobox', { name: 'Filtrar por representante' });
    expect(select).toHaveValue('');
    expect(await screen.findByRole('option', { name: 'Eduarda Fischer' })).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Todos os representantes',
      'Eduarda Fischer',
      'Rafael Schmitt',
    ]);
  });

  it('escolher "Rafael Schmitt" muda o representante no contexto; "Todos os representantes" volta para nenhum', async () => {
    renderizarComo(
      'GESTOR',
      <>
        <SeletorRepresentante />
        <Sonda />
      </>,
    );

    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');
    await screen.findByRole('option', { name: 'Rafael Schmitt' });
    const select = screen.getByRole('combobox', { name: 'Filtrar por representante' });

    await userEvent.selectOptions(select, 'u2');

    expect(screen.getByTestId('sonda')).toHaveTextContent('u2');
    expect(select).toHaveValue('u2');

    await userEvent.selectOptions(select, 'Todos os representantes');

    expect(screen.getByTestId('sonda')).toHaveTextContent('nenhum');
    expect(select).toHaveValue('');
  });

  it('para o representante, não renderiza nada', () => {
    const { container } = renderizarComo('REPRESENTANTE', <SeletorRepresentante />);

    expect(container).toBeEmptyDOMElement();
  });
});
