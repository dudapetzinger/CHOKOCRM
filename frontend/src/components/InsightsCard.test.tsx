/** Testes do `InsightsCard`: textos do estado sem histórico e ausência de avisos sobre a fonte do ERP. */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buscarInsights } from '../services/insights';
import { InsightsCard } from './InsightsCard';

vi.mock('../services/insights', () => ({
  buscarInsights: vi.fn(),
  buscarAlertasDeProducao: vi.fn(),
}));

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InsightsCard clienteId="c1" />
    </QueryClientProvider>,
  );
}

describe('InsightsCard', () => {
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

    expect(await screen.findByText(/Nenhum evento sazonal nos próximos 90 dias/)).toBeInTheDocument();
    expect(screen.queryByText(/Dados simulados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma nota/)).not.toBeInTheDocument();
  });
});
