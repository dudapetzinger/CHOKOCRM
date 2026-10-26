import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { RepresentanteProvider } from '../representante/RepresentanteContext';
import { ApiError } from '../services/api';
import { buscarAgendaDoDia, buscarCalendario, type Agenda, type AgendaItem } from '../services/agenda';
import { listarCampanhas, type Campanha } from '../services/campaigns';
import { concluirLembrete, type LembreteItem } from '../services/lembretes';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
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

function renderizarComo(role: Role, resposta: Resposta) {
  prepararResposta(resposta);
  const auth = {
    user: { id: 'u1', nome: 'Usuário', email: 'usuario@exemplo.com', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
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

/** Nome de um título de seção: o `aria-label` com a contagem ou, sem ele, o texto ("Roteiro do dia"). */
function nomeDoTitulo(titulo: HTMLElement): string | null {
  return titulo.getAttribute('aria-label') ?? titulo.textContent;
}

/** A seção pelo nome da região, que é o título com a contagem ("Atrasadas · 1"). */
function secao(nome: string) {
  return screen.getByRole('region', { name: nome });
}

beforeEach(() => {
  simularLargura(false);
  vi.mocked(listarCampanhas).mockReset().mockResolvedValue([]);
  vi.mocked(buscarCalendario)
    .mockReset()
    .mockImplementation(async (mes) => ({ mes, itens: [] }));
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
    expect(atrasadas.getByText('Joinville · Visita prevista venceu há 5 dias')).toBeInTheDocument();

    const hoje = within(secao('Hoje · 1'));
    expect(hoje.getByText('Empório Central')).toBeInTheDocument();
    expect(hoje.getByText('Vencendo · 14 dias sem visita')).toBeInTheDocument();
    expect(hoje.getByText('Blumenau · Visita prevista para hoje')).toBeInTheDocument();

    expect(screen.queryByText('Nenhuma visita atrasada ou prevista para hoje.')).not.toBeInTheDocument();
  });

  it('"Visita prevista venceu há 1 dia" usa o singular', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [{ ...ATRASADA, diasAtraso: 1 }], hoje: [] });

    expect(await screen.findByText('Joinville · Visita prevista venceu há 1 dia')).toBeInTheDocument();
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

  it('mostra a seção "Próximos 7 dias" só quando há itens', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], proximos7Dias: [PROXIMA] });

    const proximos = within(await screen.findByRole('region', { name: 'Próximos 7 dias · 1' }));
    expect(proximos.getByText('Armazém São Bento')).toBeInTheDocument();
    expect(proximos.getByText('Pomerode · Prevista para 20/10')).toBeInTheDocument();
    expect(proximos.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/clientes/c3/check-in');
    // Depois de Atrasadas (sem visitas de hoje, não há roteiro)
    const titulos = screen.getAllByRole('heading', { level: 2 });
    expect(titulos.map(nomeDoTitulo)).toEqual(['Atrasadas · 1', 'Próximos 7 dias · 1']);
  });

  it('sem visitas nos próximos 7 dias, a seção não aparece', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE], proximos7Dias: [] });

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas · 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /^Próximos 7 dias/ })).not.toBeInTheDocument();
  });

  it('só com visitas nos próximos 7 dias: a mensagem de hoje e a seção dos próximos', async () => {
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA] });

    expect(await screen.findByText('Nenhuma visita atrasada ou prevista para hoje.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Próximos 7 dias · 1' })).toBeInTheDocument();
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

    expect(await screen.findByRole('region', { name: 'Atrasadas · 1' })).toHaveTextContent('Doces da Vovó');
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
    expect(await screen.findByRole('region', { name: 'Atrasadas · 1' })).toHaveTextContent('Doces da Vovó');

    vi.mocked(buscarAgendaDoDia).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    await act(() => queryClient.refetchQueries({ queryKey: ['agenda'] }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(within(secao('Atrasadas · 1')).getByText('Doces da Vovó')).toBeInTheDocument();
  });
});

describe('AgendaPage — lembretes', () => {
  it('a seção "Lembretes" traz o vencido e o de hoje, entre "Hoje" e "Próximos 7 dias"', async () => {
    renderizarComo('REPRESENTANTE', {
      atrasadas: [ATRASADA],
      hoje: [HOJE],
      proximos7Dias: [PROXIMA],
      lembretes: [LEMBRETE_VENCIDO, LEMBRETE_DE_HOJE],
    });

    const lembretes = within(await screen.findByRole('region', { name: 'Lembretes · 2' }));
    const linhas = lembretes.getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Bombons & Cia');
    expect(linhas[0]).toHaveTextContent('Levar amostras de Natal');
    expect(lembretes.getByText('Gaspar · Lembrete venceu há 2 dias (24/10)')).toBeInTheDocument();
    expect(linhas[1]).toHaveTextContent('Confirmar o pedido de Natal');
    expect(lembretes.getByText('Blumenau · Lembrete para hoje')).toBeInTheDocument();
    expect(lembretes.getByRole('link', { name: /Bombons & Cia/ })).toHaveAttribute('href', '/clientes/c4');
    expect(lembretes.queryByText(/Rep\.:/)).not.toBeInTheDocument();

    const titulos = screen.getAllByRole('heading', { level: 2 });
    expect(titulos.map(nomeDoTitulo)).toEqual([
      'Roteiro do dia',
      'Atrasadas · 1',
      'Hoje · 1',
      'Lembretes · 2',
      'Próximos 7 dias · 1',
    ]);
  });

  it('"Concluir" conclui o lembrete e a linha some da agenda', async () => {
    const usuario = userEvent.setup();
    vi.mocked(concluirLembrete).mockReset().mockResolvedValue({ id: 'l1', concluidoEm: '2026-10-26T12:00:00.000Z' });
    renderizarComo('REPRESENTANTE', { hoje: [HOJE], lembretes: [LEMBRETE_VENCIDO, LEMBRETE_DE_HOJE] });
    await screen.findByRole('region', { name: 'Lembretes · 2' });

    prepararResposta({ hoje: [HOJE], lembretes: [LEMBRETE_DE_HOJE] });
    await usuario.click(screen.getByRole('button', { name: 'Concluir lembrete de Bombons & Cia' }));

    expect(concluirLembrete).toHaveBeenCalledWith('l1');
    const lembretes = await screen.findByRole('region', { name: 'Lembretes · 1' });
    expect(lembretes).not.toHaveTextContent('Bombons & Cia');
    expect(lembretes).toHaveTextContent('Empório Central');
  });

  it('sem lembretes, a seção não existe', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE], lembretes: [] });

    expect(await screen.findByRole('region', { name: 'Hoje · 1' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /^Lembretes/ })).not.toBeInTheDocument();
  });

  it('o gestor também conclui e, em "Todos", vê de qual representante é o lembrete', async () => {
    renderizarComo('GESTOR', { lembretes: [LEMBRETE_VENCIDO] });

    const lembretes = within(await screen.findByRole('region', { name: 'Lembretes · 1' }));
    expect(lembretes.getByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
    expect(lembretes.getByRole('button', { name: 'Concluir lembrete de Bombons & Cia' })).toBeInTheDocument();
  });

  it('no desktop, "Lembretes" vem na largura toda, depois das duas colunas e antes de "Próximos 7 dias"', async () => {
    simularLargura(true);
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA], lembretes: [LEMBRETE_VENCIDO] });

    const titulos = await screen.findAllByRole('heading', { level: 2 });
    expect(titulos.map(nomeDoTitulo)).toEqual(['Atrasadas · 0', 'Hoje · 0', 'Lembretes · 1', 'Próximos 7 dias · 1']);
    await waitFor(() => expect(secao('Lembretes · 1')).toHaveTextContent('Bombons & Cia'));
  });
});

describe('AgendaPage — campanhas em andamento (spec 7.6 e 7.7)', () => {
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

    await screen.findByRole('region', { name: 'Hoje · 1' });
    expect(screen.queryByRole('list', { name: 'Campanhas em andamento' })).not.toBeInTheDocument();
  });

  it('a linha do cliente traz a etiqueta da campanha da próxima visita', async () => {
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA] });

    const proximos = await screen.findByRole('region', { name: 'Próximos 7 dias · 1' });
    expect(within(proximos).getByText('Natal Chokolaten')).toBeInTheDocument();
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
    expect(titulos.map(nomeDoTitulo)).toEqual(['Roteiro do dia', 'Atrasadas · 1', 'Hoje · 1']);
    expect(within(secao('Atrasadas · 1')).getByText('Doces da Vovó')).toBeInTheDocument();
    expect(within(secao('Hoje · 1')).getByText('Empório Central')).toBeInTheDocument();
  });

  it('"Próximos 7 dias" vem depois das duas colunas, só quando há itens', async () => {
    simularLargura(true);
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA] });

    const titulos = await screen.findAllByRole('heading', { level: 2 });
    expect(titulos.map((titulo) => titulo.getAttribute('aria-label'))).toEqual([
      'Atrasadas · 0',
      'Hoje · 0',
      'Próximos 7 dias · 1',
    ]);
    expect(within(secao('Próximos 7 dias · 1')).getByText('Armazém São Bento')).toBeInTheDocument();
  });

  it('sem itens, "Próximos 7 dias" não aparece nem vazio', async () => {
    simularLargura(true);
    renderizarComo('REPRESENTANTE', {});

    expect(await screen.findByRole('heading', { level: 2, name: 'Atrasadas · 0' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /^Próximos 7 dias/ })).not.toBeInTheDocument();
  });
});

describe('AgendaPage — roteiro do dia (spec 7.9)', () => {
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
        `&origin=${encodeURIComponent('Rua XV de Novembro, 100 — Blumenau/SC')}` +
        `&destination=${encodeURIComponent('Rua das Palmeiras, 50 — Joinville/SC')}&travelmode=driving`,
    );
  });

  it('só com atrasadas, não há roteiro', async () => {
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA] });

    expect(await screen.findByRole('region', { name: 'Atrasadas · 1' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();
  });

  it('sem visitas de hoje, não há roteiro', async () => {
    renderizarComo('REPRESENTANTE', { proximos7Dias: [PROXIMA] });

    expect(await screen.findByRole('region', { name: 'Próximos 7 dias · 1' })).toBeInTheDocument();
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
      'Abrir no Google Maps — Trecho 1 de 3 (abre em nova aba)',
      'Abrir no Google Maps — Trecho 2 de 3 (abre em nova aba)',
      'Abrir no Google Maps — Trecho 3 de 3 (abre em nova aba)',
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
    expect(await screen.findByRole('region', { name: 'Hoje · 1' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();

    await screen.findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por representante' }), 'u1');

    expect(await screen.findByRole('region', { name: 'Roteiro do dia' })).toBeInTheDocument();
  });
});

describe('AgendaPage — calendário (spec 7.6)', () => {
  it('o segmentado troca a agenda do dia pelo calendário do mês, sem o roteiro', async () => {
    const usuario = userEvent.setup();
    renderizarComo('REPRESENTANTE', { atrasadas: [ATRASADA], hoje: [HOJE] });
    expect(await screen.findByRole('region', { name: 'Roteiro do dia' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Agenda do dia' })).toBeChecked();

    await usuario.click(screen.getByRole('radio', { name: 'Calendário' }));

    expect(screen.getByRole('radio', { name: 'Calendário' })).toBeChecked();
    expect(screen.getByRole('region', { name: 'Calendário do mês' })).toBeInTheDocument();
    expect(buscarCalendario).toHaveBeenCalledWith(expect.stringMatching(/^[0-9]{4}-[0-9]{2}$/), undefined);
    expect(screen.queryByRole('region', { name: 'Roteiro do dia' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Atrasadas · 1' })).not.toBeInTheDocument();
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
