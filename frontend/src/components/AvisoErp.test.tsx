import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buscarSituacaoErp, type SituacaoErp } from '../services/erp';
import { AvisoErp } from './AvisoErp';

vi.mock('../services/erp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/erp')>()),
  buscarSituacaoErp: vi.fn(),
}));

const BASE: SituacaoErp = {
  provedor: 'importado',
  simulado: false,
  estoqueDisponivel: false,
  ultimaVendaEm: '2026-11-04',
  ultimaImportacaoEm: '2026-11-05T12:00:00.000Z',
};

function renderizar(situacao: SituacaoErp) {
  vi.mocked(buscarSituacaoErp).mockReset().mockResolvedValue(situacao);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AvisoErp />
    </QueryClientProvider>,
  );
}

describe('AvisoErp', () => {
  it('provedor simulado: o texto de dados simulados', async () => {
    renderizar({ ...BASE, provedor: 'mock', simulado: true });

    expect(
      await screen.findByText('Dados simulados — integração com o ERP ainda não está disponível'),
    ).toBeInTheDocument();
  });

  it('importado com notas: até quando as vendas foram importadas', async () => {
    renderizar(BASE);

    expect(await screen.findByText('Vendas do ERP importadas até 04/11/2026')).toBeInTheDocument();
  });

  it('importado sem nenhuma nota', async () => {
    renderizar({ ...BASE, ultimaVendaEm: null, ultimaImportacaoEm: null });

    expect(await screen.findByText('Nenhuma nota importada ainda.')).toBeInTheDocument();
  });
});
