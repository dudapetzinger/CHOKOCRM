import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatarMoeda } from '@/lib/formatarMoeda';
import { MemoryRouter } from 'react-router-dom';
import { useVisitasDoPeriodo } from '@/hooks/useVisitasDoPeriodo';
import { PERIODO_PADRAO } from '@/lib/periodo';
import type { KpiRepresentante } from '@/services/dashboard';
import { consultaCarregando, consultaComErro, consultaDeVisitas } from '@/test/visitasDoPeriodo';
import { Ranking } from './Ranking';
import { ResultadoPorRepresentante } from './ResultadoPorRepresentante';
import { RitmoDeVisitas } from './RitmoDeVisitas';

/** Texto como o jest-dom compara: o espaço do Intl é inseparável, o do conteúdo vem normalizado. */
function reais(valor: number): string {
  return formatarMoeda(valor).replace(/ /g, ' ');
}

vi.mock('@/hooks/useVisitasDoPeriodo', () => ({ useVisitasDoPeriodo: vi.fn() }));

type Retorno = ReturnType<typeof useVisitasDoPeriodo>;

function carregar(consulta: unknown) {
  vi.mocked(useVisitasDoPeriodo).mockReturnValue(consulta as Retorno);
}

beforeEach(() => {
  vi.mocked(useVisitasDoPeriodo).mockReset();
  carregar(consultaDeVisitas());
});

const REPRESENTANTES: KpiRepresentante[] = [
  {
    id: 'u1',
    nome: 'Eduarda Fischer',
    clientesAtivos: 3,
    visitas: 4,
    vendas: 2,
    negociacoes: 1,
    semVenda: 1,
    conversaoEmVendas: { numerador: 2, denominador: 4, percentual: 50 },
    receita: 154,
    clientes: [
      { id: 'c1', nomeFantasia: 'Doceria Aurora', vendas: 2, negociacoes: 0, semVenda: 0 },
      { id: 'c2', nomeFantasia: 'Café Central', vendas: 0, negociacoes: 1, semVenda: 0 },
      { id: 'c3', nomeFantasia: 'Empório Sul', vendas: 0, negociacoes: 0, semVenda: 1 },
    ],
  },
  {
    id: 'u2',
    nome: 'Rafael Schmitt',
    clientesAtivos: 2,
    visitas: 2,
    vendas: 2,
    negociacoes: 0,
    semVenda: 0,
    conversaoEmVendas: { numerador: 2, denominador: 2, percentual: 100 },
    receita: 220,
    clientes: [
      { id: 'c4', nomeFantasia: 'Armazém Antigo', vendas: 1, negociacoes: 0, semVenda: 0 },
      { id: 'c5', nomeFantasia: 'Bom Doce', vendas: 1, negociacoes: 0, semVenda: 0 },
    ],
  },
];

function emRota(elemento: React.ReactElement) {
  return render(<MemoryRouter>{elemento}</MemoryRouter>);
}

function linhasDoPainel() {
  return within(screen.getByRole('dialog')).getAllByRole('listitem');
}

describe('resultado das visitas por representante: a fatia abre o painel', () => {
  function renderizar() {
    return emRota(<ResultadoPorRepresentante representantes={REPRESENTANTES} periodo={PERIODO_PADRAO} />);
  }

  it('só busca as visitas quando o painel abre', async () => {
    renderizar();
    expect(useVisitasDoPeriodo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas: Eduarda · Venda: 2' }));

    expect(useVisitasDoPeriodo).toHaveBeenCalledWith(PERIODO_PADRAO, undefined);
  });

  it('Venda: título, resumo com o total em R$ e as visitas da mais recente para a mais antiga, com link para a ficha', async () => {
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas: Eduarda · Venda: 2' }));

    const painel = screen.getByRole('dialog', { name: 'Eduarda Fischer · Venda' });
    expect(painel).toHaveAccessibleDescription(`2 visitas · ${formatarMoeda(154)}`);
    const linhas = linhasDoPainel();
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent(/24\/10\/2026/);
    expect(linhas[0]).toHaveTextContent(reais(103.90));
    expect(linhas[1]).toHaveTextContent(/20\/10\/2026/);
    expect(linhas[1]).toHaveTextContent(reais(50.10));
    const links = within(painel).getAllByRole('link', { name: 'Doceria Aurora' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/clientes/c1');
  });

  it('Negociação: resumo sem R$ e sem valor nas linhas', async () => {
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas: Eduarda · Negociação: 1' }));

    expect(screen.getByRole('dialog', { name: 'Eduarda Fischer · Negociação' })).toHaveAccessibleDescription('1 visita');
    expect(linhasDoPainel()).toHaveLength(1);
    expect(linhasDoPainel()[0]).not.toHaveTextContent('R$');
  });

  it('mostra "Carregando..." enquanto o detalhe chega', async () => {
    carregar(consultaCarregando());
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas: Eduarda · Venda: 2' }));

    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Carregando...');
  });

  it('no erro, mostra a mensagem e "Tentar de novo" busca outra vez', async () => {
    const consulta = consultaComErro();
    carregar(consulta);
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas: Eduarda · Venda: 2' }));

    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(consulta.refetch).toHaveBeenCalledTimes(1);
  });

  it('Esc fecha o painel e devolve o foco à fatia', async () => {
    renderizar();
    const fatia = screen.getByRole('button', { name: 'Ver visitas: Eduarda · Venda: 2' });
    await userEvent.click(fatia);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fatia).toHaveFocus();
  });

  it('sem o período, a fatia só mostra o balão (sem painel)', () => {
    emRota(<ResultadoPorRepresentante representantes={REPRESENTANTES} />);
    expect(screen.queryByRole('button', { name: /^Ver visitas/ })).not.toBeInTheDocument();
  });
});

describe('ritmo de visitas: a faixa abre o painel', () => {
  const RITMO = {
    granularidade: 'SEMANA' as const,
    faixas: [
      {
        inicio: '2026-10-12',
        fim: '2026-10-18',
        parcial: false,
        visitas: 3,
        vendas: 2,
        clientes: [{ id: 'c3', nomeFantasia: 'Empório Sul', visitas: 1, vendas: 0 }],
      },
      {
        inicio: '2026-10-19',
        fim: '2026-10-25',
        parcial: false,
        visitas: 3,
        vendas: 2,
        clientes: [{ id: 'c1', nomeFantasia: 'Doceria Aurora', visitas: 2, vendas: 2 }],
      },
    ],
  };

  it('abre as visitas da semana com o resultado de cada uma e o resumo "N visitas, M com venda"', async () => {
    emRota(<RitmoDeVisitas ritmo={RITMO} periodo={PERIODO_PADRAO} />);
    expect(useVisitasDoPeriodo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /^Ver visitas: Semana de 19\/10/ }));

    const painel = screen.getByRole('dialog', { name: 'Semana de 19/10' });
    expect(painel).toHaveAccessibleDescription('3 visitas, 2 com venda');
    const linhas = linhasDoPainel();
    expect(linhas.map((linha) => within(linha).getByRole('link').textContent)).toEqual([
      'Doceria Aurora',
      'Café Central',
      'Doceria Aurora',
    ]);
    expect(linhas[0]).toHaveTextContent('Houve venda');
    expect(linhas[1]).toHaveTextContent('Em negociação');
    expect(linhas[2]).toHaveTextContent('Houve venda');
    expect(within(linhas[1]).getByRole('link')).toHaveAttribute('href', '/clientes/c2');
  });

  it('por mês, o título é o mês curto; sem visitas, o painel diz isso', async () => {
    const porMes = {
      granularidade: 'MES' as const,
      faixas: [{ inicio: '2026-10-01', fim: '2026-10-31', parcial: false, visitas: 0, vendas: 0, clientes: [] }],
    };
    emRota(<RitmoDeVisitas ritmo={porMes} periodo={PERIODO_PADRAO} />);
    await userEvent.click(screen.getByRole('button', { name: /^Ver visitas: out\/26/ }));

    expect(screen.getByRole('dialog', { name: 'out/26' })).toHaveAccessibleDescription('0 visitas, 0 com venda');
    expect(screen.getByText('Nenhuma visita.')).toBeInTheDocument();
  });
});

describe('ranking: a linha do representante abre as visitas agrupadas por cliente', () => {
  function renderizar() {
    return emRota(<Ranking representantes={REPRESENTANTES} periodo={PERIODO_PADRAO} />);
  }

  it('receita: um cliente por linha, quem mais comprou primeiro, com visitas e total', async () => {
    renderizar();
    expect(useVisitasDoPeriodo).not.toHaveBeenCalled();

    const lista = screen.getByRole('list', { name: 'Ranking de receita' });
    await userEvent.click(within(lista).getByRole('button', { name: 'Ver visitas de Eduarda no período, Receita' }));

    const painel = screen.getByRole('dialog', { name: 'Eduarda Fischer · Receita' });
    expect(painel).toHaveAccessibleDescription(formatarMoeda(154));
    const linhas = linhasDoPainel();
    expect(linhas.map((linha) => within(linha).getByRole('link').textContent)).toEqual([
      'Doceria Aurora',
      'Café Central',
      'Empório Sul',
    ]);
    expect(linhas[0]).toHaveTextContent('2 visitas');
    expect(linhas[0]).toHaveTextContent(reais(154.00));
    expect(linhas[1]).toHaveTextContent('1 visita');
    expect(within(linhas[0]).getByRole('link')).toHaveAttribute('href', '/clientes/c1');
  });

  it('a consulta leva o representante do filtro do Painel', async () => {
    emRota(<Ranking representantes={REPRESENTANTES} periodo={PERIODO_PADRAO} representanteId="u9" />);
    await userEvent.click(
      within(screen.getByRole('list', { name: 'Ranking de visitas' })).getByRole('button', {
        name: 'Ver visitas de Eduarda no período, Visitas',
      }),
    );

    expect(useVisitasDoPeriodo).toHaveBeenCalledWith(PERIODO_PADRAO, 'u9');
  });

  it('visitas e conversão: o resumo segue a métrica da lista', async () => {
    renderizar();
    await userEvent.click(
      within(screen.getByRole('list', { name: 'Ranking de visitas' })).getByRole('button', {
        name: 'Ver visitas de Eduarda no período, Visitas',
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Eduarda Fischer · Visitas' })).toHaveAccessibleDescription('4 visitas');
    await userEvent.keyboard('{Escape}');

    await userEvent.click(
      within(screen.getByRole('list', { name: 'Ranking de conversão' })).getByRole('button', {
        name: 'Ver visitas de Eduarda no período, Conversão em vendas',
      }),
    );
    expect(screen.getByRole('dialog', { name: 'Eduarda Fischer · Conversão em vendas' })).toHaveAccessibleDescription(
      '2 de 4 visitas com venda',
    );
  });
});
