import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** A resposta do servidor: a agenda, um erro (a requisição falha) ou `'carregando'` (nunca responde). */
function prepararResposta(resposta: Agenda | Error | 'carregando') {
  if (resposta === 'carregando') {
    vi.mocked(buscarAgendaDoDia).mockReturnValue(new Promise(() => {}));
  } else if (resposta instanceof Error) {
    vi.mocked(buscarAgendaDoDia).mockRejectedValue(resposta);
  } else {
    vi.mocked(buscarAgendaDoDia).mockResolvedValue(resposta);
  }
}

function renderizarComo(role: Role, resposta: Agenda | Error | 'carregando') {
  prepararResposta(resposta);
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

/** A seção pelo nome da região, que é o título com a contagem ("Atrasadas · 1"). */
function secao(nome: string) {
  return screen.getByRole('region', { name: nome });
}

beforeEach(() => {
  simularLargura(false);
});

afterEach(() => {
  removerSimulacaoDeLargura();
});

describe('AgendaPage (celular)', () => {
  it('com uma visita atrasada e uma de hoje, mostra as duas seções, cada uma com a contagem e a situação do cliente', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas · 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Hoje · 1' })).toBeInTheDocument();

    const atrasadas = within(secao('Atrasadas · 1'));
    expect(atrasadas.getByText('Doces da Vovó')).toBeInTheDocument();
    expect(atrasadas.getByText('Atrasado · 40 dias sem visita')).toBeInTheDocument();
    expect(atrasadas.getByText('Joinville · Próxima visita venceu há 5 dias')).toBeInTheDocument();

    const hoje = within(secao('Hoje · 1'));
    expect(hoje.getByText('Empório Central')).toBeInTheDocument();
    expect(hoje.getByText('Vencendo · 14 dias sem visita')).toBeInTheDocument();
    expect(hoje.getByText('Blumenau · Visita prevista para hoje')).toBeInTheDocument();

    expect(screen.queryByText('Nenhuma visita atrasada ou prevista para hoje.')).not.toBeInTheDocument();
  });

  it('"Próxima visita venceu há 1 dia" usa o singular', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [{ ...ATRASADA, diasAtraso: 1 }], hoje: [] });

    expect(await screen.findByText('Joinville · Próxima visita venceu há 1 dia')).toBeInTheDocument();
  });

  it('cada visita é um item de lista e a contagem acompanha o número de itens', async () => {
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA, { ...ATRASADA, id: 'c3', nomeFantasia: 'Bombons & Cia' }],
      hoje: [HOJE],
    });

    const atrasadas = within(await screen.findByRole('region', { name: 'Atrasadas · 2' }));
    expect(atrasadas.getAllByRole('listitem')).toHaveLength(2);
    expect(within(secao('Hoje · 1')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('o nome do cliente leva à ficha', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    const ficha = await screen.findByRole('link', { name: /Doces da Vovó/ });
    expect(ficha).toHaveAttribute('href', '/clientes/c1');
  });

  it('o representante tem o atalho de check-in e não vê a linha "Rep.:"', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    const checkIn = await screen.findByRole('link', { name: 'Check-in' });
    expect(checkIn).toHaveAttribute('href', '/clientes/c1/check-in');
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Filtrar por representante' })).not.toBeInTheDocument();
  });

  it('uma seção sem itens não aparece (só a que tem visitas)', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas · 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /^Hoje/ })).not.toBeInTheDocument();
  });

  it('agenda vazia mostra uma única mensagem e nenhuma seção', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [], hoje: [] });

    expect(await screen.findByText('Nenhuma visita atrasada ou prevista para hoje.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Nenhuma visita/)).toHaveLength(1);
  });

  it('gestor com o seletor em "Todos" vê de qual representante é cada cliente, sem atalho de check-in', async () => {
    renderizarComo('GESTOR', { atrasadas: [ATRASADA], hoje: [HOJE] });

    expect(await screen.findByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(screen.getByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check-in' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filtrar por representante' })).toHaveValue('');
  });

  it('gestor que escolhe um representante busca a agenda dele e deixa de ver a linha "Rep.:"', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', { atrasadas: [ATRASADA], hoje: [] });
    expect(await screen.findByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(buscarAgendaDoDia).toHaveBeenLastCalledWith(undefined);

    await screen.findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por representante' }), 'u1');

    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
    expect(buscarAgendaDoDia).toHaveBeenLastCalledWith('u1');
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });

  it('enquanto a agenda carrega, avisa; sem nenhuma seção ainda', () => {
    renderizarComo('REPRESENTANTE', 'carregando');

    expect(screen.getByText('Carregando agenda...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('se a agenda não carrega, mostra o erro no aviso e nenhuma seção', async () => {
    renderizarComo('REPRESENTANTE', new ApiError('NETWORK', 'Você está sem internet.'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
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

describe('AgendaPage (tablet, de 768 a 1023 px)', () => {
  it('as seções ficam empilhadas, como no celular: a seção sem visitas não aparece', async () => {
    simularLargura(900);
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas · 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /^Hoje/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhuma visita prevista para hoje.')).not.toBeInTheDocument();
  });
});

describe('AgendaPage (desktop, a partir de 1024 px)', () => {
  it('mostra as duas colunas mesmo vazias, cada uma com a sua frase e a contagem 0', async () => {
    simularLargura(1024);
    renderizarComo('REPRESENTANTE', { atrasadas: [], hoje: [] });

    expect(await screen.findByText('Nenhuma visita atrasada.')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma visita prevista para hoje.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Atrasadas · 0' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Hoje · 0' })).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma visita atrasada ou prevista para hoje.')).not.toBeInTheDocument();
  });

  it('com visitas, Atrasadas vem antes de Hoje e cada uma traz os seus clientes', async () => {
    simularLargura(true);
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] });

    const titulos = await screen.findAllByRole('heading', { level: 2 });
    expect(titulos.map((titulo) => titulo.getAttribute('aria-label'))).toEqual(['Atrasadas · 1', 'Hoje · 1']);
    expect(within(secao('Atrasadas · 1')).getByText('Doces da Vovó')).toBeInTheDocument();
    expect(within(secao('Hoje · 1')).getByText('Empório Central')).toBeInTheDocument();
  });
});
