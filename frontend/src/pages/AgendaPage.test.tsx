import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { RepresentanteProvider } from '../representante/RepresentanteContext';
import { ApiError } from '../services/api';
import { buscarAgendaDoDia, type Agenda, type AgendaItem } from '../services/agenda';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
import { AgendaPage } from './AgendaPage';

vi.mock('../services/agenda', () => ({ buscarAgendaDoDia: vi.fn() }));

vi.mock('../services/users', () => ({
  listRepresentantes: vi.fn().mockResolvedValue([
    { id: 'u1', nome: 'Eduarda Fischer' },
    { id: 'u2', nome: 'Rafael Schmitt' },
  ]),
}));

const ATRASADA: AgendaItem = {
  id: 'c1',
  nomeFantasia: 'Doces da Vovó',
  cidade: 'Joinville',
  cor: 'VERMELHO',
  diasSemVisita: 40,
  proximaVisita: '2026-10-10',
  diasAtraso: 5,
  rebaixadoPorVenda: false,
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
};

const HOJE: AgendaItem = {
  id: 'c2',
  nomeFantasia: 'Empório Central',
  cidade: 'Blumenau',
  cor: 'LARANJA',
  diasSemVisita: 14,
  proximaVisita: '2026-10-15',
  diasAtraso: 0,
  rebaixadoPorVenda: false,
  representante: { id: 'u2', nome: 'Rafael Schmitt' },
};

function renderizarComo(role: Role, agenda: Agenda) {
  vi.mocked(buscarAgendaDoDia).mockResolvedValue(agenda);
  const auth = {
    user: { id: 'u1', nome: 'Usuário', email: 'usuario@exemplo.com', role },
    login: vi.fn(),
    logout: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <RepresentanteProvider>
          <MemoryRouter initialEntries={['/agenda']}>
            <AgendaPage />
          </MemoryRouter>
        </RepresentanteProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient };
}

beforeEach(() => {
  simularLargura(false);
});

afterEach(() => {
  removerSimulacaoDeLargura();
});

describe('AgendaPage (celular)', () => {
  it('com uma visita atrasada e uma de hoje, mostra as duas seções com a situação de cada cliente', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Hoje' })).toBeInTheDocument();

    expect(screen.getByText('Doces da Vovó')).toBeInTheDocument();
    expect(screen.getByText('Atrasado · 40 dias sem visita')).toBeInTheDocument();
    expect(screen.getByText('Joinville · Próxima visita venceu há 5 dias')).toBeInTheDocument();

    expect(screen.getByText('Empório Central')).toBeInTheDocument();
    expect(screen.getByText('Vencendo · 14 dias sem visita')).toBeInTheDocument();
    expect(screen.getByText('Blumenau · Visita prevista para hoje')).toBeInTheDocument();

    expect(screen.queryByText('Nenhuma visita atrasada ou prevista para hoje.')).not.toBeInTheDocument();
  });

  it('o representante tem o atalho de check-in e não vê a linha "Rep.:"', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    const checkIn = await screen.findByRole('link', { name: 'Check-in' });
    expect(checkIn).toHaveAttribute('href', '/clientes/c1/check-in');
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });

  it('uma seção sem itens não aparece (só a que tem visitas)', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Hoje' })).not.toBeInTheDocument();
  });

  it('agenda vazia mostra uma única mensagem e nenhuma seção', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [], hoje: [] });

    expect(await screen.findByText('Nenhuma visita atrasada ou prevista para hoje.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Atrasadas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Hoje' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Nenhuma visita/)).toHaveLength(1);
  });

  it('gestor com o seletor em "Todos" vê de qual representante é cada cliente, sem atalho de check-in', async () => {
    renderizarComo('GESTOR', { atrasadas: [ATRASADA], hoje: [HOJE] });

    expect(await screen.findByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(screen.getByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check-in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('com a agenda já carregada, um refetch que falha por rede mantém as visitas e mostra o aviso acima', async () => {
    const { queryClient } = renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });
    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();

    vi.mocked(buscarAgendaDoDia).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    await act(() => queryClient.refetchQueries({ queryKey: ['agenda'] }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.getByText('Doces da Vovó')).toBeInTheDocument();
  });
});

describe('AgendaPage (desktop)', () => {
  it('mostra as duas colunas mesmo vazias, cada uma com a sua frase', async () => {
    simularLargura(true);
    renderizarComo('REPRESENTANTE', { atrasadas: [], hoje: [] });

    expect(await screen.findByText('Nenhuma visita atrasada.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma visita prevista para hoje.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Atrasadas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Hoje' })).toBeInTheDocument();
  });
});
