/** Testes do `InsightsCard`: textos do estado sem histórico e ausência de avisos sobre a fonte do ERP. */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buscarInsights, type Insights } from '../services/insights';
import { InsightsCard } from './InsightsCard';

vi.mock('../services/insights', () => ({
  buscarInsights: vi.fn(),
  buscarSazonalidade: vi.fn(),
}));

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InsightsCard clienteId="c1" />
    </QueryClientProvider>,
  );
}

type SugestaoTeste = Extract<Insights, { status: 'OK' }>['sugestoes'][number];
type CampanhaTeste = SugestaoTeste['campanhas'][number];

function campanha(extra: Partial<CampanhaTeste> = {}): CampanhaTeste {
  return {
    id: 'camp1',
    nome: 'Promoção de Natal',
    tipo: 'PROMOCAO',
    inicio: '2026-12-01',
    fim: '2026-12-31',
    desconto: 12,
    situacao: 'EM_ANDAMENTO',
    ...extra,
  };
}

function sugestao(campanhas: CampanhaTeste[]): SugestaoTeste {
  return {
    evento: { id: 'e1', nome: 'Natal 2026', dataEvento: '2026-12-25', diasAteEvento: 35 },
    acao: 'MANTER_OFERTA',
    variacaoPercentual: 5,
    periodoComparado: { inicio: '2025-11-25', fim: '2025-12-25' },
    comprasNaJanela: 1200.5,
    mediaNaJanela: 1143.3,
    produtosMaisComprados: [],
    campanhas,
    titulo: 'Natal em 35 dias',
    texto: 'As compras no mesmo período do ano passado ficaram na média (+5%). Manter a oferta.',
  };
}

function responderComSugestao(campanhas: CampanhaTeste[]) {
  vi.mocked(buscarInsights).mockResolvedValue({
    status: 'OK',
    simulado: false,
    horizonteDias: 90,
    sugestoes: [sugestao(campanhas)],
    eventosSemHistorico: [],
  });
}

describe('InsightsCard', () => {
  it('mostra o rótulo "Manter a oferta" e o texto do servidor para a ação MANTER_OFERTA', async () => {
    responderComSugestao([]);

    renderizar();

    expect(await screen.findByText('Manter a oferta')).toBeInTheDocument();
    expect(screen.getByText(/ficaram na média \(\+5%\)/)).toBeInTheDocument();
  });

  it('lista a campanha em andamento com o desconto', async () => {
    responderComSugestao([campanha()]);

    renderizar();

    expect(
      await screen.findByText('Promoção em andamento: Promoção de Natal (12% de desconto)'),
    ).toBeInTheDocument();
  });

  it('omite os parênteses da campanha em andamento sem desconto', async () => {
    responderComSugestao([campanha({ nome: 'Ovos', tipo: 'CAMPANHA', desconto: null })]);

    renderizar();

    expect(await screen.findByText('Campanha em andamento: Ovos')).toBeInTheDocument();
  });

  it('lista a campanha programada com as datas de início e fim', async () => {
    responderComSugestao([campanha({ nome: 'Feira', tipo: 'EVENTO', situacao: 'PROGRAMADA' })]);

    renderizar();

    expect(await screen.findByText('Evento programado: Feira, de 01/12 a 31/12')).toBeInTheDocument();
  });

  it('não fala de campanhas quando não há nenhuma', async () => {
    responderComSugestao([]);

    renderizar();

    await screen.findByText('Manter a oferta');
    expect(screen.queryByText(/andamento:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/programad[ao]:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nenhuma campanha/i)).not.toBeInTheDocument();
  });

  it('lista a campanha da entrada sem histórico', async () => {
    vi.mocked(buscarInsights).mockResolvedValue({
      status: 'OK',
      simulado: false,
      horizonteDias: 180,
      sugestoes: [],
      eventosSemHistorico: [
        {
          id: 'e2',
          nome: 'Páscoa 2027',
          diasAteEvento: 128,
          campanhas: [
            campanha({ nome: 'Ovos 2027', tipo: 'CAMPANHA', inicio: '2027-03-01', fim: '2027-03-28', desconto: null, situacao: 'PROGRAMADA' }),
          ],
        },
      ],
    });

    renderizar();

    expect(await screen.findByText(/Páscoa 2027/)).toBeInTheDocument();
    expect(screen.getByText('Campanha programada: Ovos 2027, de 01/03 a 28/03')).toBeInTheDocument();
  });

  it('o bloco é recolhível e abre expandido', async () => {
    responderComSugestao([]);

    renderizar();

    await screen.findByText('Manter a oferta');
    expect(screen.getByRole('button', { name: /Insights e sugestões/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('SEM_ERP_ID: "Sem histórico de compras para este cliente."', async () => {
    vi.mocked(buscarInsights).mockResolvedValue({ status: 'SEM_ERP_ID' });

    renderizar();

    expect(await screen.findByText('Sem histórico de compras para este cliente.')).toBeInTheDocument();
    expect(screen.queryByText(/sem identificador de ERP/)).not.toBeInTheDocument();
  });

  it('OK: sem aviso de dados simulados nem de notas importadas', async () => {
    vi.mocked(buscarInsights).mockResolvedValue({
      status: 'OK',
      simulado: true,
      horizonteDias: 90,
      sugestoes: [],
      eventosSemHistorico: [],
    });

    renderizar();

    expect(await screen.findByText(/Nenhuma data comemorativa nos próximos 90 dias/)).toBeInTheDocument();
    expect(screen.queryByText(/Dados simulados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma nota/)).not.toBeInTheDocument();
  });
});
