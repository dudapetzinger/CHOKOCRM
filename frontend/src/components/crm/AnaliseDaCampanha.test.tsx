import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Campanha } from '../../services/campaigns';
import { listarMetas, type Meta } from '../../services/goals';
import { RESUMO_VAZIO } from '../../test/campanhas';
import { AnaliseDaCampanha } from './AnaliseDaCampanha';

vi.mock('../../services/goals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/goals')>()),
  listarMetas: vi.fn(),
}));

const PASCOA: Campanha = {
  id: 'cp1',
  nome: 'Páscoa Chokolaten',
  tipo: 'PROMOCAO',
  inicio: '2026-03-01',
  fim: '2026-04-05',
  descricao: '',
  desconto: 10,
  produtos: [],
  status: 'ENCERRADA',
  resultados: [
    {
      representante: { id: 'r1', nome: 'Eduarda Fischer' },
      visitas: 5,
      clientesAtendidos: 3,
      vendas: 1503.7,
      conversao: { numerador: 2, denominador: 5, percentual: 40 },
    },
    {
      representante: { id: 'r2', nome: 'Rafael Schmitt' },
      visitas: 3,
      clientesAtendidos: 3,
      vendas: 2096,
      conversao: { numerador: 2, denominador: 3, percentual: 67 },
    },
  ],
  produtosMaisVendidos: [
    { sku: 'OVO-350', nome: 'Ovo de Páscoa 350 g', quantidade: 40, total: 2800 },
    { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 19, total: 799.7 },
  ],
  vendas: [],
  resumo: {
    visitas: 8,
    vendasFechadas: 4,
    clientesAtendidos: 6,
    vendas: 3599.7,
    conversao: { numerador: 4, denominador: 8, percentual: 50 },
    ticketMedio: 899.93,
  },
};

function meta(id: string, representante: { id: string; nome: string }, extras: Partial<Meta>): Meta {
  return {
    id,
    representante,
    periodo: 'CAMPANHA',
    inicio: '2026-03-01',
    fim: '2026-04-05',
    metaVisitas: 10,
    metaVendas: 2000,
    campanhaId: 'cp1',
    campanha: { id: 'cp1', nome: 'Páscoa Chokolaten', inicio: '2026-03-01', fim: '2026-04-05' },
    realizado: { visitas: 0, vendas: 0, clientes: [] },
    ...extras,
  };
}

const EDUARDA = { id: 'r1', nome: 'Eduarda Fischer' };
const RAFAEL = { id: 'r2', nome: 'Rafael Schmitt' };

const METAS: Meta[] = [
  meta('m1', EDUARDA, { realizado: { visitas: 5, vendas: 1503.7, clientes: [] } }),
  meta('m2', RAFAEL, { metaVisitas: 6, realizado: { visitas: 3, vendas: 2096, clientes: [] } }),
];

beforeEach(() => {
  vi.mocked(listarMetas).mockReset().mockResolvedValue(METAS);
});

function renderizar(campanha: Campanha = PASCOA, gestor = true) {
  const aoFechar = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AnaliseDaCampanha campanha={campanha} gestor={gestor} aoFechar={aoFechar} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { aoFechar, painel: screen.getByRole('dialog', { name: 'Análise · Páscoa Chokolaten' }) };
}

/** O valor ao lado de um rótulo do resumo. */
function valorDe(painel: HTMLElement, rotulo: string): string {
  return within(painel).getByText(rotulo, { selector: 'dt' }).nextElementSibling?.textContent ?? '';
}

describe('AnaliseDaCampanha', () => {
  it('abre o painel com o nome da campanha, o período e a duração em dias', () => {
    const { painel } = renderizar();

    expect(painel).toHaveAccessibleDescription('01/03/2026 a 05/04/2026 · 36 dias');
  });

  it('o resumo mostra os totais que o backend calculou', () => {
    const { painel } = renderizar();

    expect(valorDe(painel, 'Total vendido')).toMatch(/R\$\s3\.599,70/);
    expect(valorDe(painel, 'Número de vendas')).toBe('4');
    expect(valorDe(painel, 'Visitas vinculadas')).toBe('8');
    expect(valorDe(painel, 'Clientes atendidos')).toBe('6');
    expect(valorDe(painel, 'Conversão')).toMatch(/^50\s%$/);
    expect(valorDe(painel, 'Valor médio por venda')).toMatch(/R\$\s899,93/);
  });

  it('as metas da campanha aparecem somadas, contra o realizado', async () => {
    const { painel } = renderizar();

    const visitas = await within(painel).findByRole('progressbar', { name: 'Progresso de Visitas' });
    expect(visitas).toHaveAttribute('aria-valuetext', expect.stringMatching(/^8 de 16 · 50\s%$/));
    expect(within(painel).getByRole('progressbar', { name: 'Progresso de Vendas' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/^R\$\s3\.599,70 de R\$\s4\.000,00 · 89\s%$/),
    );
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: 'cp1', representanteId: undefined, periodo: undefined });
  });

  it('duas metas do mesmo representante somam o alvo, mas o realizado dele conta uma vez só', async () => {
    // Depois de encerrar, duas metas da Eduarda ficaram com o mesmo período: cada uma traz as mesmas 5 visitas
    vi.mocked(listarMetas).mockResolvedValue([
      meta('m1', EDUARDA, { realizado: { visitas: 5, vendas: 1503.7, clientes: [] } }),
      meta('m3', EDUARDA, { realizado: { visitas: 5, vendas: 1503.7, clientes: [] } }),
    ]);
    const { painel } = renderizar();

    const visitas = await within(painel).findByRole('progressbar', { name: 'Progresso de Visitas' });
    expect(visitas).toHaveAttribute('aria-valuetext', expect.stringMatching(/^5 de 20 · 25\s%$/));
    expect(within(painel).getByRole('progressbar', { name: 'Progresso de Vendas' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/^R\$\s1\.503,70 de R\$\s4\.000,00 · 37\s%$/),
    );
  });

  it('quem não tem meta na campanha não entra no realizado das metas', async () => {
    vi.mocked(listarMetas).mockResolvedValue([meta('m2', RAFAEL, { metaVisitas: 6 })]);
    const { painel } = renderizar();

    const visitas = await within(painel).findByRole('progressbar', { name: 'Progresso de Visitas' });
    expect(visitas).toHaveAttribute('aria-valuetext', expect.stringMatching(/^3 de 6 · 50\s%$/));
  });

  it('sem metas, diz que a campanha não teve meta', async () => {
    vi.mocked(listarMetas).mockResolvedValue([]);
    const { painel } = renderizar();

    expect(await within(painel).findByText('Nenhuma meta definida para esta campanha.')).toBeInTheDocument();
    expect(within(painel).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('o gestor vê quem mais vendeu, com o valor e as visitas', () => {
    const { painel } = renderizar();

    const destaque = within(painel).getByRole('region', { name: 'Quem mais vendeu' });
    expect(destaque).toHaveTextContent('Rafael Schmitt');
    expect(destaque).toHaveTextContent(/R\$\s2\.096,00 em 3 visitas/);
    expect(destaque).not.toHaveTextContent('Eduarda Fischer');
  });

  it('lista os produtos mais vendidos, com a quantidade e o valor', () => {
    const { painel } = renderizar();

    const produtos = within(painel).getByRole('list', { name: 'Produtos mais vendidos' });
    const itens = within(produtos).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent(/Ovo de Páscoa 350 g: 40 un\. · R\$\s2\.800,00/);
  });

  it('campanha sem visita vinculada: nada de número inventado', () => {
    const { painel } = renderizar({
      ...PASCOA,
      resultados: [{ ...PASCOA.resultados[0], visitas: 0, clientesAtendidos: 0, vendas: 0 }],
      produtosMaisVendidos: [],
      resumo: RESUMO_VAZIO,
    });

    expect(valorDe(painel, 'Conversão')).toBe('Sem dados');
    expect(valorDe(painel, 'Valor médio por venda')).toBe('Sem dados');
    expect(within(painel).getByRole('region', { name: 'Quem mais vendeu' })).toHaveTextContent(
      'Nenhuma venda vinculada à campanha.',
    );
    expect(within(painel).getByText('Nenhum pedido vinculado à campanha.')).toBeInTheDocument();
  });

  it('o representante não vê "Quem mais vendeu": os números já são só os dele', () => {
    const { painel } = renderizar(PASCOA, false);

    expect(within(painel).queryByRole('region', { name: 'Quem mais vendeu' })).not.toBeInTheDocument();
    expect(valorDe(painel, 'Total vendido')).toMatch(/R\$\s3\.599,70/);
  });

  it('"Fechar" avisa quem abriu', async () => {
    const { aoFechar, painel } = renderizar();

    await userEvent.click(within(painel).getByRole('button', { name: 'Fechar' }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
