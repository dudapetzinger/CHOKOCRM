import { api } from './api';
import { buscarKpisPorRepresentante, buscarRelatorio } from './dashboard';
import { listarMetas } from './goals';
import { buscarKpis } from './kpis';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  api: { get: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: [] });
});

describe('serviços com período', () => {
  it('buscarKpis: período em dias vai como periodoDias', async () => {
    await buscarKpis({ dias: 90 });

    expect(api.get).toHaveBeenCalledWith('/dashboard/kpis?periodoDias=90');
  });

  it('buscarKpis: faixa personalizada vai como inicio e fim, sem periodoDias, e com o representante', async () => {
    await buscarKpis({ inicio: '2026-10-01', fim: '2026-10-25' }, 'u1');

    expect(api.get).toHaveBeenCalledWith('/dashboard/kpis?inicio=2026-10-01&fim=2026-10-25&representanteId=u1');
  });

  it('buscarKpisPorRepresentante e buscarRelatorio seguem o mesmo contrato', async () => {
    await buscarKpisPorRepresentante({ dias: 365 }, 'u1');
    await buscarRelatorio({ inicio: '2025-01-01', fim: '2026-10-25' });

    expect(api.get).toHaveBeenNthCalledWith(1, '/dashboard/kpis/por-representante?periodoDias=365&representanteId=u1');
    expect(api.get).toHaveBeenNthCalledWith(2, '/dashboard/relatorio?inicio=2025-01-01&fim=2026-10-25');
  });

  it('listarMetas: sem período não manda nenhum; com período, o filtro certo', async () => {
    await listarMetas({});
    await listarMetas({ campanhaId: 'cp1', periodo: { dias: 30 } });
    await listarMetas({ representanteId: 'u1', periodo: { inicio: '2026-10-01', fim: '2026-10-25' } });

    expect(api.get).toHaveBeenNthCalledWith(1, '/goals');
    expect(api.get).toHaveBeenNthCalledWith(2, '/goals?campanhaId=cp1&periodoDias=30');
    expect(api.get).toHaveBeenNthCalledWith(3, '/goals?representanteId=u1&inicio=2026-10-01&fim=2026-10-25');
  });
});
