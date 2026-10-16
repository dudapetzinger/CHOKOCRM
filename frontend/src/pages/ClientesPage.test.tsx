import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/auth-context';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
import { ClientesPage } from './ClientesPage';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  listClients: vi.fn(async () => []),
}));

vi.mock('../representante/useRepresentante', () => ({
  useRepresentante: () => ({ representanteId: null, setRepresentanteId: vi.fn() }),
  useRepresentanteSelecionado: () => undefined,
}));

vi.mock('../hooks/useRepresentantes', () => ({
  useRepresentantes: () => ({ data: [] }),
}));

function renderizar() {
  const auth = {
    user: { id: 'r1', nome: 'Eduarda', email: 'eduarda@exemplo.com', role: 'REPRESENTANTE' as const },
    login: vi.fn(),
    logout: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clientes']}>
          <ClientesPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  removerSimulacaoDeLargura();
});

describe('ClientesPage', () => {
  it('no desktop, sem cliente escolhido, mostra "Selecione um cliente" ao lado da lista', async () => {
    simularLargura(true);
    renderizar();

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
  });

  it('no celular, mostra só a lista', async () => {
    simularLargura(false);
    renderizar();

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
  });
});
