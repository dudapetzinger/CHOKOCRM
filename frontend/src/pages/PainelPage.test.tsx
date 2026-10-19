import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/auth-context';
import { Toaster } from '../components/ui/sonner';
import { useClientesDaCarteira, useKpisPorRepresentante, useVendasMensais } from '../hooks/useDashboard';
import { useAlertasDeProducao } from '../hooks/useInsights';
import { useKpis } from '../hooks/useKpis';
import { baixarCsv } from '../lib/csv';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { ApiError } from '../services/api';
import type { ClienteListItem } from '../services/clients';
import {
  buscarRelatorio,
  type KpisPorRepresentante,
  type LinhaDoRelatorio,
  type VendasMensais,
} from '../services/dashboard';
import { listarMetas, type Meta } from '../services/goals';
import type { Alertas } from '../services/insights';
import type { Kpis } from '../services/kpis';
import { PainelPage } from './PainelPage';

vi.mock('../representante/useRepresentante', () => ({
  useRepresentante: () => ({ representanteId: null, setRepresentanteId: vi.fn() }),
  useRepresentanteSelecionado: vi.fn(),
}));

vi.mock('../hooks/useRepresentantes', () => ({
  useRepresentantes: () => ({ data: [{ id: 'u1', nome: 'Eduarda Fischer' }] }),
}));

vi.mock('../hooks/useKpis', () => ({ useKpis: vi.fn() }));

vi.mock('../hooks/useDashboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useDashboard')>()),
  useKpisPorRepresentante: vi.fn(),
  useVendasMensais: vi.fn(),
  useClientesDaCarteira: vi.fn(),
}));

vi.mock('../services/dashboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/dashboard')>()),
  buscarRelatorio: vi.fn(),
}));

vi.mock('../lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/csv')>()),
  baixarCsv: vi.fn(),
}));

vi.mock('../hooks/useInsights', () => ({ useAlertasDeProducao: vi.fn() }));

vi.mock('../services/goals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/goals')>()),
  listarMetas: vi.fn(),
}));

const META_DA_EDUARDA: Meta = {
  id: 'm1',
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
  periodo: 'MENSAL',
  inicio: '2026-10-01',
  fim: '2026-10-31',
  metaVisitas: 10,
  metaVendas: 6000,
  campanhaId: null,
  realizado: { visitas: 7, vendas: 4200 },
};

function consulta<T>(data: T) {
  return { data, isLoading: false, isError: false, error: null, isPlaceholderData: false };
}

const KPIS: Kpis = {
  periodo: { dias: 30, inicio: '2026-09-15', fim: '2026-10-14' },
  clientesAtivos: 3,
  visitas: { total: 12, mediaPorCliente: 1.7 },
  taxaDeRegistro: { numerador: 2, denominador: 3, percentual: 67 },
  conversaoEmVendas: { numerador: 5, denominador: 12, percentual: 42 },
  inativos: { total: 1, distribuicao: { VERDE: 1, AMARELO: 1, LARANJA: 0, VERMELHO: 1 } },
  semDados: false,
  simulado: true,
};

const POR_REPRESENTANTE: KpisPorRepresentante = {
  periodo: KPIS.periodo,
  representantes: [
    {
      id: 'u1',
      nome: 'Eduarda Fischer',
      clientesAtivos: 3,
      visitas: 12,
      vendas: 5,
      negociacoes: 4,
      semVenda: 3,
      conversaoEmVendas: { numerador: 5, denominador: 12, percentual: 42 },
    },
  ],
  ritmoSemanal: [
    { inicio: '2026-08-24', visitas: 1, vendas: 0 },
    { inicio: '2026-08-31', visitas: 2, vendas: 1 },
    { inicio: '2026-09-07', visitas: 0, vendas: 0 },
    { inicio: '2026-09-14', visitas: 3, vendas: 1 },
    { inicio: '2026-09-21', visitas: 4, vendas: 2 },
    { inicio: '2026-09-28', visitas: 2, vendas: 1 },
    { inicio: '2026-10-05', visitas: 1, vendas: 0 },
    { inicio: '2026-10-12', visitas: 2, vendas: 1 },
  ],
  simulado: false,
};

const VENDAS: VendasMensais = {
  meses: [
    { mes: '2026-09', total: 1000, clientesComDados: 3 },
    { mes: '2026-10', total: 1500, clientesComDados: 3 },
  ],
  eventos: [],
  simulado: false,
  clientesConsultados: 3,
  clientesIndisponiveis: 0,
};

const ALERTAS: Alertas = {
  simulado: false,
  horizonteDias: 90,
  eventos: [
    {
      id: 'e1',
      nome: 'Natal',
      dataEvento: '2026-12-25',
      diasAteEvento: 72,
      produtosSugeridos: ['bombons sortidos', 'caixas presente'],
    },
  ],
  alertas: [],
  clientesConsultados: 3,
  clientesIndisponiveis: 0,
};

const CLIENTE_ESFRIANDO: ClienteListItem = {
  id: 'c1',
  nomeFantasia: 'Doces da Vovó',
  razaoSocial: 'Doces da Vovó Ltda',
  cidade: 'Joinville',
  telefone: '(47) 99900-8080',
  ativo: true,
  contatoPrincipal: null,
  cor: 'VERMELHO',
  diasSemVisita: 40,
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
  rebaixadoPorVenda: false,
};

const LINHA_DO_RELATORIO: LinhaDoRelatorio = {
  cliente: 'Doces da Vovó',
  cidade: 'Joinville',
  representante: 'Eduarda Fischer',
  situacao: 'Vermelho',
  diasSemVisita: 40,
  visitasNoPeriodo: 0,
  vendasNoPeriodo: 0,
};

type Retorno<F extends (...args: never[]) => unknown> = ReturnType<F>;

beforeEach(() => {
  vi.mocked(buscarRelatorio).mockReset().mockResolvedValue([LINHA_DO_RELATORIO]);
  vi.mocked(baixarCsv).mockReset();
  vi.mocked(listarMetas).mockReset().mockResolvedValue([META_DA_EDUARDA]);
  vi.mocked(useRepresentanteSelecionado).mockReturnValue(undefined);
  vi.mocked(useKpis).mockReturnValue(consulta(KPIS) as unknown as Retorno<typeof useKpis>);
  vi.mocked(useKpisPorRepresentante).mockReturnValue(
    consulta(POR_REPRESENTANTE) as unknown as Retorno<typeof useKpisPorRepresentante>,
  );
  vi.mocked(useVendasMensais).mockReturnValue(consulta(VENDAS) as unknown as Retorno<typeof useVendasMensais>);
  vi.mocked(useClientesDaCarteira).mockReturnValue(
    consulta([CLIENTE_ESFRIANDO]) as unknown as Retorno<typeof useClientesDaCarteira>,
  );
  vi.mocked(useAlertasDeProducao).mockReturnValue(consulta(ALERTAS) as unknown as Retorno<typeof useAlertasDeProducao>);
});

function renderizarComo(role: 'GESTOR' | 'REPRESENTANTE') {
  const auth = {
    user:
      role === 'GESTOR'
        ? { id: 'g1', nome: 'Maicon', email: 'gestor@exemplo.com', role, telefone: null, ativo: true }
        : { id: 'u1', nome: 'Eduarda Fischer', email: 'eduarda@exemplo.com', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          <PainelPage />
          <Toaster />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('PainelPage (gestor)', () => {
  it('barra com o select de representante e o segmentado de período; faixa de dados simulados', () => {
    renderizarComo('GESTOR');

    expect(screen.getByRole('combobox', { name: 'Filtrar por representante' })).toBeInTheDocument();
    const periodo = screen.getByRole('radiogroup', { name: 'Período de análise dos indicadores' });
    expect(within(periodo).getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual([
      '30 dias',
      '90 dias',
      '365 dias',
    ]);
    expect(screen.getByText('Dados simulados — integração com o ERP ainda não está disponível')).toBeInTheDocument();
  });

  it('sem dados simulados, a faixa não aparece', () => {
    vi.mocked(useKpis).mockReturnValue(consulta({ ...KPIS, simulado: false }) as unknown as Retorno<typeof useKpis>);
    renderizarComo('GESTOR');

    expect(screen.queryByText(/Dados simulados/)).not.toBeInTheDocument();
  });

  it('título "Quem está visitando pouco?" com o período e os clientes ativos, e os quatro indicadores', () => {
    renderizarComo('GESTOR');

    const bloco = screen.getByRole('region', { name: 'Quem está visitando pouco?' });
    expect(within(bloco).getByText('15/09/2026 a 14/10/2026 · 3 clientes ativos')).toBeInTheDocument();
    const indicadores = within(bloco).getAllByRole('term').map((termo) => [
      termo.textContent,
      ...[...(termo.parentElement?.querySelectorAll('dd') ?? [])].map((definicao) => definicao.textContent),
    ]);
    expect(indicadores).toEqual([
      ['Visitas no período', '12', 'média de 1,7 por cliente'],
      ['Taxa de registro', '67%', '2 de 3 clientes com check-in ou mensagem'],
      ['Conversão em vendas', '42%', '5 de 12 visitas com venda'],
      ['Clientes inativos', '1', 'laranja e vermelho, hoje'],
    ]);
  });

  it('os blocos na ordem do protótipo (metas logo abaixo dos KPIs, mapa entre o estoque e a época do ano)', () => {
    renderizarComo('GESTOR');

    const titulos = screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent);
    expect(titulos).toEqual([
      'Quem está visitando pouco?',
      'Metas de visitas e vendas',
      'Resultado das visitas por representante',
      'Ritmo de visitas — últimas 8 semanas',
      'Quais clientes estão esfriando?',
      'O próximo evento está chegando e o estoque acompanha?',
      'Mapa de clientes por cidade',
      'Época do ano',
    ]);
    expect(screen.getByRole('button', { name: 'Planilha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
  });

  it('mapa de clientes por cidade com a carteira carregada no Painel', () => {
    renderizarComo('GESTOR');

    const mapa = screen.getByRole('region', { name: 'Mapa de clientes por cidade' });
    expect(
      within(mapa).getByRole('button', { name: 'Joinville: 1 cliente, situação mais urgente vermelho' }),
    ).toBeInTheDocument();
  });

  it('"Planilha" busca o relatório do período e do representante e baixa o CSV', async () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue('u1');
    renderizarComo('GESTOR');

    await userEvent.click(screen.getByRole('button', { name: 'Planilha' }));

    expect(await screen.findByText('Planilha gerada')).toBeInTheDocument();
    expect(buscarRelatorio).toHaveBeenCalledWith(30, 'u1');
    expect(baixarCsv).toHaveBeenCalledTimes(1);
    const [conteudo, nome] = vi.mocked(baixarCsv).mock.calls[0]!;
    expect(conteudo.startsWith('\uFEFF"Cliente";"Cidade";')).toBe(true);
    expect(conteudo).toContain('"Doces da Vovó";"Joinville";"Eduarda Fischer";"Vermelho";"40";"0";"0,00"');
    expect(nome).toMatch(/^chokocrm-relatorio-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('"Planilha" com o período de 90 dias pede o relatório de 90', async () => {
    renderizarComo('GESTOR');
    const periodo = screen.getByRole('radiogroup', { name: 'Período de análise dos indicadores' });

    await userEvent.click(within(periodo).getByRole('radio', { name: '90 dias' }));
    await userEvent.click(screen.getByRole('button', { name: 'Planilha' }));

    expect(await screen.findByText('Planilha gerada')).toBeInTheDocument();
    expect(buscarRelatorio).toHaveBeenCalledWith(90, undefined);
  });

  it('se o relatório falha, avisa e não baixa nada', async () => {
    vi.mocked(buscarRelatorio).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizarComo('GESTOR');

    await userEvent.click(screen.getByRole('button', { name: 'Planilha' }));

    expect(await screen.findByText('Você está sem internet.')).toBeInTheDocument();
    expect(baixarCsv).not.toHaveBeenCalled();
  });

  it('"PDF" abre a impressão do navegador', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderizarComo('GESTOR');

    await userEvent.click(screen.getByRole('button', { name: 'PDF' }));

    expect(imprimir).toHaveBeenCalledTimes(1);
    imprimir.mockRestore();
  });

  it('resultado por representante em barra empilhada e ritmo das 8 semanas com a nota', () => {
    renderizarComo('GESTOR');

    const resultado = screen.getByRole('region', { name: 'Resultado das visitas por representante' });
    expect(
      within(resultado).getByRole('img', { name: 'Eduarda: 12 visitas, 5 com venda, 4 em negociação, 3 sem venda' }),
    ).toBeInTheDocument();

    const ritmo = screen.getByRole('region', { name: 'Ritmo de visitas — últimas 8 semanas' });
    expect(within(within(ritmo).getByRole('table')).getAllByRole('row')).toHaveLength(9);
    expect(within(ritmo).getByText('Barra clara = visitas · parte escura = visitas com venda')).toBeInTheDocument();
  });

  it('com um representante escolhido, os blocos buscam a carteira dele', () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue('u1');
    renderizarComo('GESTOR');

    expect(useKpis).toHaveBeenCalledWith(30, 'u1');
    expect(useKpisPorRepresentante).toHaveBeenCalledWith(30, 'u1');
    expect(useVendasMensais).toHaveBeenCalledWith('u1');
    expect(useClientesDaCarteira).toHaveBeenCalledWith('u1');
    expect(useAlertasDeProducao).toHaveBeenCalledWith(90, 'u1');
  });

  it('metas de visitas e vendas: as sem campanha, com o progresso e "Nova meta" para o gestor', async () => {
    renderizarComo('GESTOR');

    const metas = screen.getByRole('region', { name: 'Metas de visitas e vendas' });
    expect(await within(metas).findByText('R$ 4.200,00 de R$ 6.000,00 · 70 %')).toBeInTheDocument();
    expect(within(metas).getByText('7 de 10 · 70 %')).toBeInTheDocument();
    expect(within(metas).getByRole('button', { name: 'Nova meta' })).toBeInTheDocument();
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: undefined, representanteId: undefined });
  });

  it('as metas seguem o representante escolhido', async () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue('u1');
    renderizarComo('GESTOR');

    await screen.findByText('7 de 10 · 70 %');
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: undefined, representanteId: 'u1' });
  });

  it('trocar o período para 90 dias refaz os indicadores e o resultado por representante com 90', async () => {
    renderizarComo('GESTOR');
    const periodo = screen.getByRole('radiogroup', { name: 'Período de análise dos indicadores' });

    await userEvent.click(within(periodo).getByRole('radio', { name: '90 dias' }));

    expect(useKpis).toHaveBeenLastCalledWith(90, undefined);
    expect(useKpisPorRepresentante).toHaveBeenLastCalledWith(90, undefined);
    expect(within(periodo).getByRole('radio', { name: '90 dias' })).toHaveAttribute('aria-checked', 'true');
  });

  it('quais clientes estão esfriando: distribuição por cor e os mais urgentes, que levam à ficha', () => {
    renderizarComo('GESTOR');

    const bloco = screen.getByRole('region', { name: 'Quais clientes estão esfriando?' });
    expect(
      within(bloco).getByRole('img', { name: /1 clientes verdes, 1 amarelos, 0 laranjas e 1 vermelhos/ }),
    ).toBeInTheDocument();
    expect(within(bloco).getByRole('heading', { level: 3, name: 'Mais urgentes' })).toBeInTheDocument();
    expect(within(bloco).getByRole('link', { name: /Doces da Vovó/ })).toHaveAttribute('href', '/clientes/c1');
  });

  it('o próximo evento: vendas mensais com a tabela acessível e os alertas de produção com o horizonte', () => {
    renderizarComo('GESTOR');

    const bloco = screen.getByRole('region', { name: 'O próximo evento está chegando e o estoque acompanha?' });
    expect(within(bloco).getByRole('table', { name: 'Vendas mensais dos últimos 12 meses (R$)' })).toBeInTheDocument();
    expect(within(bloco).getByRole('heading', { level: 3, name: 'Alertas de produção' })).toBeInTheDocument();
    expect(within(bloco).getByRole('radiogroup', { name: 'Horizonte de eventos sazonais' })).toBeInTheDocument();
    expect(within(bloco).getByText('Nenhum alerta de produção para os próximos 90 dias.')).toBeInTheDocument();
  });

  it('época do ano lista os eventos do horizonte com a data, o prazo e os produtos sugeridos', () => {
    renderizarComo('GESTOR');

    const bloco = screen.getByRole('region', { name: 'Época do ano' });
    const itens = within(bloco).getAllByRole('listitem');
    expect(itens).toHaveLength(1);
    expect(itens[0]).toHaveTextContent('Natal');
    expect(itens[0]).toHaveTextContent('25/12/2026 · em 72 dias');
    expect(itens[0]).toHaveTextContent('Produtos sugeridos: bombons sortidos e caixas presente.');
  });

  it('com as vendas zeradas nos 12 meses, diz "Sem vendas nos últimos 12 meses."', () => {
    vi.mocked(useVendasMensais).mockReturnValue(
      consulta({ ...VENDAS, meses: VENDAS.meses.map((mes) => ({ ...mes, total: 0 })) }) as unknown as Retorno<
        typeof useVendasMensais
      >,
    );
    renderizarComo('GESTOR');

    expect(screen.getByText('Sem vendas nos últimos 12 meses.')).toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: /Vendas mensais/ })).not.toBeInTheDocument();
  });

  it('com os clientes no cache e um refetch que falhou por rede, mantém a lista e mostra o aviso acima', () => {
    vi.mocked(useClientesDaCarteira).mockReturnValue({
      ...consulta([CLIENTE_ESFRIANDO]),
      isError: true,
      error: new ApiError('NETWORK', 'Você está sem internet.'),
    } as unknown as Retorno<typeof useClientesDaCarteira>);
    renderizarComo('GESTOR');

    expect(screen.getByRole('alert')).toHaveTextContent('Você está sem internet.');
    const esfriando = screen.getByRole('region', { name: 'Quais clientes estão esfriando?' });
    expect(within(esfriando).getByText('Doces da Vovó')).toBeInTheDocument();
  });

  it('sem os números por representante ainda, avisa que está carregando', () => {
    vi.mocked(useKpisPorRepresentante).mockReturnValue({
      ...consulta(undefined),
      isLoading: true,
    } as unknown as Retorno<typeof useKpisPorRepresentante>);
    renderizarComo('GESTOR');

    expect(screen.getAllByText('Carregando gráfico de visitas...')).toHaveLength(2);
  });
});

describe('PainelPage (representante)', () => {
  it('"Como está a minha carteira?" sem o select de representante, com o período e os blocos da própria carteira', () => {
    renderizarComo('REPRESENTANTE');

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Período de análise dos indicadores' })).toBeInTheDocument();
    const bloco = screen.getByRole('region', { name: 'Como está a minha carteira?' });
    expect(within(bloco).getByText('15/09/2026 a 14/10/2026 · 3 clientes ativos')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)).toEqual([
      'Como está a minha carteira?',
      'Metas de visitas e vendas',
      'Resultado das minhas visitas',
      'Ritmo de visitas — últimas 8 semanas',
      'Quais clientes estão esfriando?',
      'O próximo evento está chegando e o estoque acompanha?',
      'Mapa de clientes por cidade',
      'Época do ano',
    ]);
    expect(screen.queryByText('Quem está visitando pouco?')).not.toBeInTheDocument();
    expect(screen.queryByText('Painel disponível apenas para o gestor.')).not.toBeInTheDocument();
  });

  it('os blocos buscam sem representanteId (o backend prende à carteira dele)', () => {
    renderizarComo('REPRESENTANTE');

    expect(useKpis).toHaveBeenCalledWith(30, undefined);
    expect(useKpisPorRepresentante).toHaveBeenCalledWith(30, undefined);
    expect(useVendasMensais).toHaveBeenCalledWith(undefined);
    expect(useClientesDaCarteira).toHaveBeenCalledWith(undefined);
    expect(useAlertasDeProducao).toHaveBeenCalledWith(90, undefined);
  });

  it('resultado das minhas visitas e os mais urgentes sem o nome do representante', () => {
    renderizarComo('REPRESENTANTE');

    const resultado = screen.getByRole('region', { name: 'Resultado das minhas visitas' });
    expect(
      within(resultado).getByRole('img', { name: 'Eduarda: 12 visitas, 5 com venda, 4 em negociação, 3 sem venda' }),
    ).toBeInTheDocument();
    const esfriando = screen.getByRole('region', { name: 'Quais clientes estão esfriando?' });
    expect(within(esfriando).getByRole('link', { name: /Doces da Vovó/ })).not.toHaveTextContent('Eduarda');
  });

  it('metas só de leitura: as dele, sem "Nova meta"', async () => {
    renderizarComo('REPRESENTANTE');

    const metas = screen.getByRole('region', { name: 'Metas de visitas e vendas' });
    expect(await within(metas).findByText('7 de 10 · 70 %')).toBeInTheDocument();
    expect(within(metas).queryByRole('button', { name: 'Nova meta' })).not.toBeInTheDocument();
    expect(within(metas).queryByRole('button', { name: /Editar|Excluir/ })).not.toBeInTheDocument();
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: undefined, representanteId: undefined });
  });

  it('"Planilha" gera o CSV da própria carteira e "PDF" imprime', async () => {
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderizarComo('REPRESENTANTE');

    await userEvent.click(screen.getByRole('button', { name: 'Planilha' }));
    expect(await screen.findByText('Planilha gerada')).toBeInTheDocument();
    expect(buscarRelatorio).toHaveBeenCalledWith(30, undefined);
    expect(baixarCsv).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'PDF' }));
    expect(imprimir).toHaveBeenCalledTimes(1);
    imprimir.mockRestore();
  });
});
