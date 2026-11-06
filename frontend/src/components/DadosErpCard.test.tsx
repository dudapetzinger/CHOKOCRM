import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buscarDadosErp, buscarSituacaoErp, type DadosErp } from '../services/erp';
import { DadosErpCard } from './DadosErpCard';

vi.mock('../services/erp', () => ({
  buscarDadosErp: vi.fn(),
  buscarSituacaoErp: vi.fn(),
}));

type DadosOk = Extract<DadosErp, { status: 'OK' }>;

function dadosOk(sobrescrever: Partial<DadosOk> = {}): DadosOk {
  return {
    status: 'OK',
    simulado: true,
    ultimaVenda: { data: '2026-10-20T13:00:00.000Z', valor: 1200 },
    volume90Dias: { total: 3600, quantidadeVendas: 3 },
    estoque: { nivel: 'NORMAL', atualizadoEm: '2026-10-20T13:00:00.000Z', itensBaixos: [] },
    estoqueIndisponivel: false,
    ultimasVendas: [],
    ...sobrescrever,
  };
}

function venda(data: string, valor: number, nome: string, quantidade: number): DadosOk['ultimasVendas'][number] {
  return { data, valor, produtos: [{ sku: `SKU-${data}`, nome, quantidade }] };
}

beforeEach(() => {
  vi.mocked(buscarSituacaoErp).mockReset().mockResolvedValue({
    provedor: 'importado',
    simulado: false,
    estoqueDisponivel: false,
    ultimaVendaEm: '2026-11-03',
    ultimaImportacaoEm: '2026-11-04T12:00:00.000Z',
  });
});

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DadosErpCard clienteId="c1" />
    </QueryClientProvider>,
  );
}

describe('DadosErpCard', () => {
  it('lista as últimas vendas com data, valor e itens', async () => {
    vi.mocked(buscarDadosErp).mockResolvedValue(
      dadosOk({
        estoque: null,
        estoqueIndisponivel: true,
        ultimasVendas: [
          {
            data: '2026-11-03',
            valor: 1529.98,
            produtos: [
              { sku: '1001', nome: 'BARRA AO LEITE 35% 500 G', quantidade: 16 },
              { sku: '1002', nome: 'BARRA MEIO AMARGO 50% 1 KG', quantidade: 0.5 },
            ],
          },
          venda('2026-10-20', 800, 'DROPS AO LEITE 1 KG', 4),
          venda('2026-10-06', 640.5, 'GOTAS MEIO AMARGO 2 KG', 3),
          venda('2026-09-22', 300, 'BARRA BRANCO 1 KG', 2),
          venda('2026-09-01', 150, 'CACAU EM PÓ 500 G', 1),
        ],
      }),
    );

    renderizar();

    const lista = await screen.findByRole('list', { name: 'Últimas vendas' });
    // Só as notas (filhas diretas): os itens de cada nota são uma lista dentro dela.
    const notas = within(lista)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === lista);
    expect(notas).toHaveLength(5);
    // Data de calendário dividida como texto: 03/11, nunca 02/11 pelo fuso.
    expect(notas[0]).toHaveTextContent('03/11/2026');
    expect(notas[0]).toHaveTextContent(/R\$\s1\.529,98/);
    expect(notas[0]).toHaveTextContent('16× BARRA AO LEITE 35% 500 G');
    expect(notas[0]).toHaveTextContent('0,5× BARRA MEIO AMARGO 50% 1 KG');
    expect(notas[4]).toHaveTextContent('01/09/2026');
    expect(notas[4]).toHaveTextContent('1× CACAU EM PÓ 500 G');
  });

  it('mostra a origem de cada venda: NF <número> ou Pedido do check-in; sem origem, nada a mais', async () => {
    vi.mocked(buscarDadosErp).mockResolvedValue(
      dadosOk({
        ultimasVendas: [
          { ...venda('2026-11-03', 100, 'A', 1), origem: { tipo: 'nota', numero: '2455' } },
          { ...venda('2026-10-20', 200, 'B', 2), origem: { tipo: 'pedido', visitaId: 'v1' } },
          venda('2026-10-06', 300, 'C', 3),
        ],
      }),
    );

    renderizar();

    const lista = await screen.findByRole('list', { name: 'Últimas vendas' });
    const vendas = within(lista)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === lista);
    expect(vendas[0]).toHaveTextContent('NF 2455');
    expect(vendas[1]).toHaveTextContent('Pedido do check-in');
    expect(vendas[2]).not.toHaveTextContent('NF');
    expect(vendas[2]).not.toHaveTextContent('Pedido do check-in');
  });

  it('estoque indisponível: mostra a frase no lugar do nível de estoque', async () => {
    vi.mocked(buscarDadosErp).mockResolvedValue(dadosOk({ estoque: null, estoqueIndisponivel: true }));

    renderizar();

    expect(await screen.findByText('O ERP não informa o estoque do cliente.')).toBeInTheDocument();
    expect(screen.queryByText(/Estoque estimado/)).not.toBeInTheDocument();
  });

  it('dados simulados: mantém o nível de estoque e não mostra a seção de últimas vendas', async () => {
    vi.mocked(buscarDadosErp).mockResolvedValue(dadosOk());

    renderizar();

    expect(await screen.findByText('Estoque estimado: Normal')).toBeInTheDocument();
    expect(screen.queryByText('Últimas vendas')).not.toBeInTheDocument();
    expect(screen.queryByText('O ERP não informa o estoque do cliente.')).not.toBeInTheDocument();
  });

  it('sem estoque e sem a marca de indisponível, segue "sem dados"', async () => {
    vi.mocked(buscarDadosErp).mockResolvedValue(dadosOk({ estoque: null }));

    renderizar();

    expect(await screen.findByText('Estoque estimado: sem dados')).toBeInTheDocument();
  });
});
