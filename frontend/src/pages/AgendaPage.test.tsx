import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { RepresentanteProvider } from '../representante/RepresentanteContext';
import { ApiError } from '../services/api';
import { buscarAgendaDoDia, buscarCalendario, type Agenda, type AgendaItem } from '../services/agenda';
import { listarCampanhas, type Campanha } from '../services/campaigns';
import { RESUMO_VAZIO } from '../test/campanhas';
import { concluirLembrete, type LembreteItem } from '../services/lembretes';
import { AgendaPage } from './AgendaPage';

vi.mock('../services/agenda', () => ({ buscarAgendaDoDia: vi.fn(), buscarCalendario: vi.fn() }));
vi.mock('../services/lembretes', () => ({ concluirLembrete: vi.fn(), listarLembretesDoCliente: vi.fn() }));
vi.mock('../services/campaigns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/campaigns')>()),
  listarCampanhas: vi.fn(),
}));

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
  endereco: 'Rua das Palmeiras, 50',
  cor: 'VERMELHO',
  diasSemVisita: 40,
  proximaVisita: '2026-10-10',
  diasAtraso: 5,
  marcadaNoCheckIn: false,
  proximaCampanha: null,
  rebaixadoPorVenda: false,
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
};

const HOJE: AgendaItem = {
  id: 'c2',
  nomeFantasia: 'Empório Central',
  cidade: 'Blumenau',
  endereco: 'Rua XV de Novembro, 100',
  cor: 'LARANJA',
  diasSemVisita: 14,
  proximaVisita: '2026-10-15',
  diasAtraso: 0,
  marcadaNoCheckIn: false,
  proximaCampanha: null,
  rebaixadoPorVenda: false,
  representante: { id: 'u2', nome: 'Rafael Schmitt' },
};

const PROXIMA: AgendaItem = {
  id: 'c3',
  nomeFantasia: 'Armazém São Bento',
  cidade: 'Pomerode',
  endereco: 'Rua Hermann Weege, 100',
  cor: 'VERDE',
  diasSemVisita: 3,
  proximaVisita: '2026-10-20',
  diasAtraso: -2,
  marcadaNoCheckIn: true,
  proximaCampanha: { id: 'cp2', nome: 'Natal Chokolaten' },
  rebaixadoPorVenda: false,
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
};

const LEMBRETE_VENCIDO: LembreteItem = {
  id: 'l1',
  clienteId: 'c4',
  nomeFantasia: 'Bombons & Cia',
  cidade: 'Gaspar',
  texto: 'Levar amostras de Natal',
  data: '2026-10-24',
  diasAtraso: 2,
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
};

const LEMBRETE_DE_HOJE: LembreteItem = {
  id: 'l2',
  clienteId: 'c2',
  nomeFantasia: 'Empório Central',
  cidade: 'Blumenau',
  texto: 'Confirmar o pedido de Natal',
  data: '2026-10-26',
  diasAtraso: 0,
  representante: { id: 'u2', nome: 'Rafael Schmitt' },
};

/**
 * A resposta do servidor: a agenda (as listas omitidas vêm vazias), um erro
 * (a requisição falha) ou `'carregando'` (nunca responde).
 */
type Resposta = Partial<Agenda> | Error | 'carregando';

function prepararResposta(resposta: Resposta) {
  if (resposta === 'carregando') {
    vi.mocked(buscarAgendaDoDia).mockReturnValue(new Promise(() => {}));
  } else if (resposta instanceof Error) {
    vi.mocked(buscarAgendaDoDia).mockRejectedValue(resposta);
  } else {
    vi.mocked(buscarAgendaDoDia).mockResolvedValue({ atrasadas: [], hoje: [], proximos7Dias: [], lembretes: [], ...resposta });
  }
}

function renderizarComo(role: Role, resposta: Resposta, entrada = '/agenda') {
  prepararResposta(resposta);
  const auth = {
    user: { id: 'u1', nome: 'Usuário', usuario: 'usuario', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <RepresentanteProvider>
          <MemoryRouter initialEntries={[entrada]}>
            <AgendaPage />
            <LocalizacaoAtual />
          </MemoryRouter>
        </RepresentanteProvider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient };
}

/** A URL atual (caminho e parâmetros), para conferir o que a página guarda nela. */
function LocalizacaoAtual() {
  const { pathname, search } = useLocation();
  return <output data-testid="url">{`${pathname}${search}`}</output>;
}

function urlAtual(): string {
  return screen.getByTestId('url').textContent ?? '';
}

/** A aba pelo nome que o leitor de tela fala: o rótulo e a contagem ("Hoje, 1"). */
function aba(nome: string) {
  return screen.getByRole('tab', { name: nome });
}

/** O painel da aba marcada. */
function painel() {
  return screen.getByRole('tabpanel');
}

/** A lista de visitas do painel (o roteiro, na aba "Hoje", é outra lista, ordenada). */
function listaDeVisitas() {
  const lista = painel().querySelector<HTMLElement>('ul');
  if (!lista) throw new Error('O painel não tem a lista de visitas.');
  return lista;
}

beforeEach(() => {
  vi.mocked(listarCampanhas).mockReset().mockResolvedValue([]);
  vi.mocked(buscarCalendario)
    .mockReset()
    .mockImplementation(async (mes) => ({ mes, itens: [] }));
});

describe('AgendaPage: abas', () => {
  it('mostra as quatro abas na ordem, cada uma com a contagem no nome', async () => {
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA, { ...ATRASADA, id: 'c9', nomeFantasia: 'Bombons & Cia' }],
      hoje: [HOJE],
      proximos7Dias: [PROXIMA],
      lembretes: [LEMBRETE_VENCIDO, LEMBRETE_DE_HOJE, { ...LEMBRETE_DE_HOJE, id: 'l3' }],
    });

    await screen.findByRole('tab', { name: 'Hoje, 1' });
    const abas = within(screen.getByRole('tablist', { name: 'Seções da agenda' })).getAllByRole('tab');
    expect(abas.map((item) => item.getAttribute('aria-label'))).toEqual([
      'Hoje, 1',
      'Atrasadas, 2',
      'Próximos 7 dias, 1',
      'Lembretes, 3',
    ]);
  });

  it('a pílula de "Atrasadas" ganha destaque só quando há visitas atrasadas', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] });
    const pilula = async (nome: string) => (await screen.findByRole('tab', { name: nome })).querySelector('[aria-hidden="true"]');

    expect(await pilula('Atrasadas, 1')).toHaveAttribute('data-destaque', 'true');
    expect(await pilula('Hoje, 1')).not.toHaveAttribute('data-destaque');
    cleanup();

    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });
    expect(await pilula('Atrasadas, 0')).not.toHaveAttribute('data-destaque');
  });

  it('abre em "Hoje" e mostra só as visitas de hoje', async () => {
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA],
      hoje: [HOJE],
      proximos7Dias: [PROXIMA],
      lembretes: [LEMBRETE_VENCIDO],
    });

    expect(await screen.findByRole('tab', { name: 'Hoje, 1' })).toHaveAttribute('aria-selected', 'true');
    expect(aba('Atrasadas, 1')).toHaveAttribute('aria-selected', 'false');
    const hoje = within(listaDeVisitas());
    expect(hoje.getByText('Empório Central')).toBeInTheDocument();
    expect(hoje.getByText('Vencendo · 14 dias sem visita')).toBeInTheDocument();
    expect(hoje.getByText('Blumenau · Visita prevista para hoje')).toBeInTheDocument();
    expect(hoje.queryByText('Doces da Vovó')).not.toBeInTheDocument();
    expect(hoje.queryByText('Armazém São Bento')).not.toBeInTheDocument();
    expect(hoje.queryByText('Bombons & Cia')).not.toBeInTheDocument();
  });

  it('cada aba mostra só a sua lista', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA],
      hoje: [HOJE],
      proximos7Dias: [PROXIMA],
      lembretes: [LEMBRETE_VENCIDO],
    });
    await screen.findByRole('tab', { name: 'Hoje, 1' });

    await usuario.click(aba('Atrasadas, 1'));
    expect(aba('Atrasadas, 1')).toHaveAttribute('aria-selected', 'true');
    let lista = within(painel());
    expect(lista.getByText('Doces da Vovó')).toBeInTheDocument();
    expect(lista.getByText('Atrasado · 40 dias sem visita')).toBeInTheDocument();
    expect(lista.getByText('Joinville · Visita prevista venceu há 5 dias')).toBeInTheDocument();
    expect(lista.queryByText('Empório Central')).not.toBeInTheDocument();

    await usuario.click(aba('Próximos 7 dias, 1'));
    lista = within(painel());
    expect(lista.getByText('Armazém São Bento')).toBeInTheDocument();
    expect(lista.getByText('Pomerode · Prevista para 20/10')).toBeInTheDocument();
    expect(lista.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/clientes/c3/check-in');
    expect(lista.queryByText('Doces da Vovó')).not.toBeInTheDocument();

    await usuario.click(aba('Lembretes, 1'));
    lista = within(painel());
    expect(lista.getByText('Levar amostras de Natal')).toBeInTheDocument();
    expect(lista.queryByText('Armazém São Bento')).not.toBeInTheDocument();
  });

  it('a aba marcada e o painel ficam ligados (o painel tem o nome da aba)', async () => {
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });

    await screen.findByRole('tab', { name: 'Hoje, 1' });
    expect(screen.getByRole('tabpanel', { name: 'Hoje, 1' })).toBeInTheDocument();
  });

  it('cada aba vazia tem o seu texto', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', {});

    await screen.findByRole('tab', { name: 'Hoje, 0' });
    expect(within(painel()).getByText('Nenhuma visita prevista para hoje.')).toBeInTheDocument();
    await usuario.click(aba('Atrasadas, 0'));
    expect(within(painel()).getByText('Nenhuma visita atrasada.')).toBeInTheDocument();
    await usuario.click(aba('Próximos 7 dias, 0'));
    expect(within(painel()).getByText('Nenhuma visita nos próximos 7 dias.')).toBeInTheDocument();
    await usuario.click(aba('Lembretes, 0'));
    expect(within(painel()).getByText('Nenhum lembrete.')).toBeInTheDocument();
  });

  it('as setas trocam de aba e levam o foco junto, e Home e End vão às pontas', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { hoje: [HOJE], atrasadas: [ATRASADA] });
    const hoje = await screen.findByRole('tab', { name: 'Hoje, 1' });
    hoje.focus();

    await usuario.keyboard('{ArrowRight}');
    expect(aba('Atrasadas, 1')).toHaveAttribute('aria-selected', 'true');
    expect(aba('Atrasadas, 1')).toHaveFocus();
    expect(within(painel()).getByText('Doces da Vovó')).toBeInTheDocument();

    await usuario.keyboard('{End}');
    expect(aba('Lembretes, 0')).toHaveAttribute('aria-selected', 'true');
    await usuario.keyboard('{ArrowRight}');
    expect(aba('Hoje, 1')).toHaveAttribute('aria-selected', 'true');
    await usuario.keyboard('{ArrowLeft}');
    expect(aba('Lembretes, 0')).toHaveAttribute('aria-selected', 'true');
  });

  it('a aba escolhida fica na URL e "Hoje" deixa a URL limpa', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });
    await screen.findByRole('tab', { name: 'Hoje, 1' });
    expect(urlAtual()).toBe('/agenda');

    await usuario.click(aba('Atrasadas, 0'));
    expect(urlAtual()).toBe('/agenda?aba=atrasadas');

    await usuario.click(aba('Hoje, 1'));
    expect(urlAtual()).toBe('/agenda');
  });

  it('a aba é restaurada da URL', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] }, '/agenda?aba=atrasadas');

    expect(await screen.findByRole('tab', { name: 'Atrasadas, 1' })).toHaveAttribute('aria-selected', 'true');
    expect(within(painel()).getByText('Doces da Vovó')).toBeInTheDocument();
  });

  it('uma aba desconhecida na URL cai em "Hoje"', async () => {
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] }, '/agenda?aba=qualquer');

    expect(await screen.findByRole('tab', { name: 'Hoje, 1' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('AgendaPage: linhas de visita', () => {
  it('"Visita prevista venceu há 1 dia" usa o singular', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { atrasadas: [{ ...ATRASADA, diasAtraso: 1 }], hoje: [] });

    await usuario.click(await screen.findByRole('tab', { name: 'Atrasadas, 1' }));
    expect(screen.getByText('Joinville · Visita prevista venceu há 1 dia')).toBeInTheDocument();
  });

  it('cada visita é um item de lista e a contagem da aba acompanha o número de itens', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA, { ...ATRASADA, id: 'c3', nomeFantasia: 'Bombons & Cia' }],
      hoje: [HOJE],
    });

    await usuario.click(await screen.findByRole('tab', { name: 'Atrasadas, 2' }));
    expect(within(painel()).getAllByRole('listitem')).toHaveLength(2);
    await usuario.click(aba('Hoje, 1'));
    expect(within(listaDeVisitas()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('o nome do cliente leva à ficha', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [] });

    await usuario.click(await screen.findByRole('tab', { name: 'Atrasadas, 1' }));
    expect(screen.getByRole('link', { name: /Doces da Vovó/ })).toHaveAttribute('href', '/clientes/c1');
  });

  it('o representante tem o atalho de check-in e não vê a linha "Rep.:"', async () => {
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });

    const checkIn = await screen.findByRole('link', { name: 'Check-in' });
    expect(checkIn).toHaveAttribute('href', '/clientes/c2/check-in');
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Filtrar por representante' })).not.toBeInTheDocument();
  });

  it('gestor com o seletor em "Todos" vê de qual representante é cada cliente, sem atalho de check-in', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', { atrasadas: [ATRASADA], hoje: [HOJE] });

    expect(await screen.findByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    await usuario.click(aba('Atrasadas, 1'));
    expect(screen.getByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Check-in' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filtrar por representante' })).toHaveValue('');
  });

  it('gestor que escolhe um representante busca a agenda dele e deixa de ver a linha "Rep.:"', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', { atrasadas: [ATRASADA], hoje: [] });
    await usuario.click(await screen.findByRole('tab', { name: 'Atrasadas, 1' }));
    expect(await screen.findByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(buscarAgendaDoDia).toHaveBeenLastCalledWith(undefined);

    await screen.findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por representante' }), 'u1');

    await waitFor(() => expect(buscarAgendaDoDia).toHaveBeenLastCalledWith('u1'));
    await waitFor(() => expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument());
    expect(painel()).toHaveTextContent('Doces da Vovó');
  });

  it('enquanto a agenda carrega, avisa; sem nenhuma aba ainda', () => {
    renderizarComo('REPRESENTANTE', 'carregando');

    // O `<output>` da URL (só do teste) também tem o papel "status": o texto escolhe o aviso da agenda.
    expect(screen.getByText('Carregando agenda...')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('se a agenda não carrega, mostra o erro no aviso e nenhuma aba', async () => {
    renderizarComo('REPRESENTANTE', new ApiError('NETWORK', 'Você está sem internet.'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('com a agenda já carregada, um refetch que falha por rede mantém as visitas e mostra o aviso acima', async () => {
    const { queryClient } = renderizarComo('REPRESENTANTE', { hoje: [HOJE] });
    expect(await screen.findByRole('tabpanel')).toHaveTextContent('Empório Central');

    vi.mocked(buscarAgendaDoDia).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    await act(() => queryClient.refetchQueries({ queryKey: ['agenda'] }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(within(listaDeVisitas()).getByText('Empório Central')).toBeInTheDocument();
  });
});

describe('AgendaPage: lembretes', () => {
  it('a aba "Lembretes" traz o vencido e o de hoje', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA],
      hoje: [HOJE],
      proximos7Dias: [PROXIMA],
      lembretes: [LEMBRETE_VENCIDO, LEMBRETE_DE_HOJE],
    });

    await usuario.click(await screen.findByRole('tab', { name: 'Lembretes, 2' }));
    const lembretes = within(painel());
    const linhas = lembretes.getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Bombons & Cia');
    expect(linhas[0]).toHaveTextContent('Levar amostras de Natal');
    expect(lembretes.getByText('Gaspar · Lembrete venceu há 2 dias (24/10)')).toBeInTheDocument();
    expect(linhas[1]).toHaveTextContent('Confirmar o pedido de Natal');
    expect(lembretes.getByText('Blumenau · Lembrete para hoje')).toBeInTheDocument();
    expect(lembretes.getByRole('link', { name: /Bombons & Cia/ })).toHaveAttribute('href', '/clientes/c4');
    expect(lembretes.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });

  it('"Concluir" conclui o lembrete e a linha some da agenda', async () => {
    const usuario = userEvent.setup();
    vi.mocked(concluirLembrete).mockReset().mockResolvedValue({ id: 'l1', concluidoEm: '2026-10-26T12:00:00.000Z' });
    renderizarComo('REPRESENTANTE', { hoje: [HOJE], lembretes: [LEMBRETE_VENCIDO, LEMBRETE_DE_HOJE] });
    await usuario.click(await screen.findByRole('tab', { name: 'Lembretes, 2' }));

    prepararResposta({ hoje: [HOJE], lembretes: [LEMBRETE_DE_HOJE] });
    await usuario.click(screen.getByRole('button', { name: 'Concluir lembrete de Bombons & Cia: Levar amostras de Natal' }));

    expect(concluirLembrete).toHaveBeenCalledWith('l1');
    expect(await screen.findByRole('tab', { name: 'Lembretes, 1' })).toHaveAttribute('aria-selected', 'true');
    expect(painel()).not.toHaveTextContent('Bombons & Cia');
    expect(painel()).toHaveTextContent('Empório Central');
  });

  it('o gestor também conclui e, em "Todos", vê de qual representante é o lembrete', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', { lembretes: [LEMBRETE_VENCIDO] });

    await usuario.click(await screen.findByRole('tab', { name: 'Lembretes, 1' }));
    const lembretes = within(painel());
    expect(lembretes.getByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(
      lembretes.getByRole('button', { name: 'Concluir lembrete de Bombons & Cia: Levar amostras de Natal' }),
    ).toBeInTheDocument();
  });
});

describe('AgendaPage: campanhas em andamento', () => {
  function campanha(id: string, nome: string, status: Campanha['status']): Campanha {
    return {
      id,
      nome,
      tipo: 'CAMPANHA',
      inicio: '2026-10-01',
      fim: '2026-12-31',
      descricao: '',
      desconto: null,
      produtos: [],
      status,
      resultados: [],
      produtosMaisVendidos: [],
      vendas: [],
      resumo: RESUMO_VAZIO,
    };
  }

  it('mostra um chip por campanha em andamento, com link para Campanhas; programadas e encerradas ficam de fora', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([
      campanha('cp1', 'Páscoa Chokolaten', 'ENCERRADA'),
      campanha('cp2', 'Natal Chokolaten', 'EM_ANDAMENTO'),
      campanha('cp3', 'Feira Sabores do Vale', 'PROGRAMADA'),
      campanha('cp4', 'Semana do Cacau', 'EM_ANDAMENTO'),
    ]);
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });

    const chips = await screen.findByRole('list', { name: 'Campanhas em andamento' });
    const links = within(chips).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Natal Chokolaten', 'Semana do Cacau']);
    for (const link of links) expect(link).toHaveAttribute('href', '/campanhas');
  });

  it('sem campanha em andamento, não há chips', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([campanha('cp3', 'Feira Sabores do Vale', 'PROGRAMADA')]);
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });

    await screen.findByRole('tab', { name: 'Hoje, 1' });
    expect(screen.queryByRole('list', { name: 'Campanhas em andamento' })).not.toBeInTheDocument();
  });

  it('a linha do cliente traz a etiqueta da campanha da próxima visita', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA] });

    await usuario.click(await screen.findByRole('tab', { name: 'Próximos 7 dias, 1' }));
    expect(within(painel()).getByText('Natal Chokolaten')).toBeInTheDocument();
  });

  it('os chips ficam acima das abas', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([campanha('cp2', 'Natal Chokolaten', 'EM_ANDAMENTO')]);
    renderizarComo('REPRESENTANTE', { hoje: [HOJE] });

    const chips = await screen.findByRole('list', { name: 'Campanhas em andamento' });
    const abas = await screen.findByRole('tablist');
    expect(chips.compareDocumentPosition(abas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AgendaPage: roteiro do dia', () => {
  it('o representante vê o roteiro só com as visitas de hoje (a atrasada fica fora), a distância e o link do Google Maps', async () => {
    const outraDeHoje: AgendaItem = { ...ATRASADA, id: 'c5', nomeFantasia: 'Bombons & Cia', diasAtraso: 0 };
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE, outraDeHoje], proximos7Dias: [PROXIMA] });

    const roteiro = within(await screen.findByRole('region', { name: 'Roteiro do dia' }));
    expect(roteiro.getByText(/^2 paradas · cerca de [0-9]+ km$/)).toBeInTheDocument();
    const paradas = roteiro.getAllByRole('listitem');
    expect(paradas).toHaveLength(2);
    expect(paradas[0]).toHaveTextContent('1Empório Central · Blumenau');
    expect(paradas[1]).toHaveTextContent(/→ [0-9]+ km →2Bombons & Cia · Joinville/);
    expect(roteiro.queryByText(/Doces da Vovó/)).not.toBeInTheDocument();
    const link = roteiro.getByRole('link', { name: /Abrir no Google Maps/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1' +
        `&origin=${encodeURIComponent('Rua XV de Novembro, 100, Blumenau/SC')}` +
        `&destination=${encodeURIComponent('Rua das Palmeiras, 50, Joinville/SC')}&travelmode=driving`,
    );
  });

  it('o roteiro fica dentro da aba "Hoje" e some nas outras', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA],
      hoje: [HOJE],
      proximos7Dias: [PROXIMA],
      lembretes: [LEMBRETE_VENCIDO],
    });

    const roteiro = await screen.findByRole('region', { name: 'Roteiro do dia' });
    expect(painel()).toContainElement(roteiro);
    for (const nome of ['Atrasadas, 1', 'Próximos 7 dias, 1', 'Lembretes, 1']) {
      await usuario.click(aba(nome));
      expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();
    }
    await usuario.click(aba('Hoje, 1'));
    expect(screen.getByRole('region', { name: 'Roteiro do dia' })).toBeInTheDocument();
  });

  it('só com atrasadas, não há roteiro', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA] });

    expect(await screen.findByRole('tab', { name: 'Atrasadas, 1' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();
  });

  it('sem visitas de hoje, não há roteiro', async () => {
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA] });

    expect(await screen.findByRole('tab', { name: 'Próximos 7 dias, 1' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();
  });

  it('com mais de 10 clientes na agenda, avisa quantos ficaram fora do roteiro', async () => {
    const hoje = Array.from({ length: 12 }, (_, i) => ({ ...ATRASADA, id: `a${i}`, nomeFantasia: `Cliente ${i}` }));
    renderizarComo('REPRESENTANTE', { hoje });

    const roteiro = within(await screen.findByRole('region', { name: 'Roteiro do dia' }));
    const paradas = roteiro.getAllByRole('listitem');
    expect(paradas).toHaveLength(10);
    expect(paradas[1]).toHaveTextContent('→ mesma cidade →2Cliente 1 · Joinville');
    expect(roteiro.getByText('+2 clientes da agenda fora do roteiro')).toBeInTheDocument();
  });

  it('com mais de 5 paradas, o roteiro vira trechos: um botão do Google Maps por trecho e a parada de emenda marcada', async () => {
    const hoje = Array.from({ length: 10 }, (_, i) => ({ ...ATRASADA, id: `a${i}`, nomeFantasia: `Cliente ${i}` }));
    renderizarComo('REPRESENTANTE', { hoje });

    const roteiro = within(await screen.findByRole('region', { name: 'Roteiro do dia' }));
    const links = roteiro.getAllByRole('link', { name: /Abrir no Google Maps/ });
    expect(links.map((link) => link.textContent)).toEqual([
      'Abrir no Google Maps: Trecho 1 de 3 (abre em nova aba)',
      'Abrir no Google Maps: Trecho 2 de 3 (abre em nova aba)',
      'Abrir no Google Maps: Trecho 3 de 3 (abre em nova aba)',
    ]);
    links.forEach((link) => expect(link).toHaveAttribute('target', '_blank'));
    const paradas = roteiro.getAllByRole('listitem');
    expect(paradas[4]).toHaveTextContent('fim do trecho 1 · início do trecho 2');
    expect(paradas[8]).toHaveTextContent('fim do trecho 2 · início do trecho 3');
    expect(paradas[3]).not.toHaveTextContent('fim do trecho');
  });

  it('o gestor só vê o roteiro depois de escolher um representante', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', { hoje: [HOJE] });
    expect(await screen.findByRole('tab', { name: 'Hoje, 1' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();

    await screen.findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por representante' }), 'u1');

    expect(await screen.findByRole('region', { name: 'Roteiro do dia' })).toBeInTheDocument();
  });
});

describe('AgendaPage: calendário', () => {
  it('o segmentado troca a agenda do dia pelo calendário do mês, sem o roteiro nem as abas', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] });
    expect(await screen.findByRole('region', { name: 'Roteiro do dia' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Agenda do dia' })).toBeChecked();

    await usuario.click(screen.getByRole('radio', { name: 'Calendário' }));

    expect(screen.getByRole('radio', { name: 'Calendário' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Calendário do mês' })).toBeInTheDocument();
    expect(buscarCalendario).toHaveBeenCalledWith(expect.stringMatching(/^[0-9]{4}-[0-9]{2}$/), undefined);
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('trocar para o calendário e voltar mantém os outros parâmetros da URL', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] }, '/agenda?rep=u1&aba=atrasadas');
    await screen.findByRole('tab', { name: 'Atrasadas, 1' });

    await usuario.click(screen.getByRole('radio', { name: 'Calendário' }));
    expect(urlAtual()).toBe('/agenda?rep=u1&aba=atrasadas&visao=calendario');

    await usuario.click(screen.getByRole('radio', { name: 'Agenda do dia' }));
    expect(urlAtual()).toBe('/agenda?rep=u1&aba=atrasadas');
    expect(await screen.findByRole('tab', { name: 'Atrasadas, 1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('a introdução do calendário fala do que foi marcado e dos lembretes', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', {});
    await usuario.click(await screen.findByRole('radio', { name: 'Calendário' }));
    expect(
      screen.getByText('As visitas marcadas e os lembretes, no dia de cada um, com as datas comemorativas.'),
    ).toBeInTheDocument();
  });

  it('a introdução do calendário do gestor inclui as campanhas e os eventos', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', {});
    await usuario.click(await screen.findByRole('radio', { name: 'Calendário' }));
    expect(
      screen.getByText(
        'As visitas marcadas e os lembretes, no dia de cada um, com as datas comemorativas, as campanhas e os eventos.',
      ),
    ).toBeInTheDocument();
  });

  it('o gestor com um representante escolhido busca o calendário dele', async () => {
    const usuario = userEvent.setup();
    renderizarComo('GESTOR', { atrasadas: [ATRASADA] });
    await screen.findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por representante' }), 'u1');

    await usuario.click(screen.getByRole('radio', { name: 'Calendário' }));

    expect(buscarCalendario).toHaveBeenLastCalledWith(expect.stringMatching(/^[0-9]{4}-[0-9]{2}$/), 'u1');
  });
});
