import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatarMoeda } from '@/lib/formatarMoeda';
import { MemoryRouter } from 'react-router-dom';
import { useClientesDaCarteira } from '../hooks/useDashboard';
import { useKpis } from '../hooks/useKpis';
import { useVisitasDoPeriodo } from '../hooks/useVisitasDoPeriodo';
import { PERIODO_PADRAO } from '../lib/periodo';
import type { ClienteListItem, Cor } from '../services/clients';
import type { Kpis } from '../services/kpis';
import { consultaCarregando, consultaDeVisitas } from '../test/visitasDoPeriodo';
import { KpisCard } from './KpisCard';

/** Texto como o jest-dom compara: o espaço do Intl é inseparável, o do conteúdo vem normalizado. */
function reais(valor: number): string {
  return formatarMoeda(valor).replace(/ /g, ' ');
}

vi.mock('../hooks/useKpis', () => ({ useKpis: vi.fn() }));
vi.mock('../hooks/useVisitasDoPeriodo', () => ({ useVisitasDoPeriodo: vi.fn() }));
vi.mock('../hooks/useDashboard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useDashboard')>()),
  useClientesDaCarteira: vi.fn(),
}));

type Retorno<F extends (...args: never[]) => unknown> = ReturnType<F>;

function consulta<T>(data: T) {
  return { data, isLoading: false, isError: false, error: null, isPlaceholderData: false };
}

const KPIS: Kpis = {
  periodo: { dias: 30, inicio: '2026-09-15', fim: '2026-10-14' },
  clientesAtivos: 4,
  visitas: { total: 12, mediaPorCliente: 3 },
  taxaDeRegistro: { numerador: 2, denominador: 4, percentual: 50 },
  conversaoEmVendas: { numerador: 5, denominador: 12, percentual: 42 },
  inativos: { total: 3, distribuicao: { VERDE: 1, AMARELO: 0, LARANJA: 1, VERMELHO: 2 } },
  semDados: false,
  simulado: false,
};

function cliente(id: string, nomeFantasia: string, cor: Cor, diasSemVisita: number | null): ClienteListItem {
  return {
    id,
    nomeFantasia,
    razaoSocial: `${nomeFantasia} Ltda`,
    cidade: 'Joinville',
    telefone: '(47) 3333-0000',
    ativo: true,
    contatoPrincipal: null,
    cor,
    diasSemVisita,
    rebaixadoPorVenda: false,
    representante: { id: 'u1', nome: 'Eduarda Fischer' },
  };
}

beforeEach(() => {
  vi.mocked(useVisitasDoPeriodo)
    .mockReset()
    .mockReturnValue(consultaDeVisitas() as unknown as Retorno<typeof useVisitasDoPeriodo>);
  vi.mocked(useKpis).mockReturnValue(consulta(KPIS) as unknown as Retorno<typeof useKpis>);
  vi.mocked(useClientesDaCarteira)
    .mockReset()
    .mockReturnValue(
      consulta([
        cliente('c1', 'Doceria Aurora', 'VERDE', 2),
        cliente('c2', 'Café Central', 'LARANJA', 20),
        cliente('c3', 'Empório Sul', 'VERMELHO', 35),
        cliente('c4', 'Armazém Novo', 'VERMELHO', null),
      ]) as unknown as Retorno<typeof useClientesDaCarteira>,
    );
});

function renderizar() {
  return render(
    <MemoryRouter>
      <KpisCard periodo={PERIODO_PADRAO} representanteId="u1" />
    </MemoryRouter>,
  );
}

describe('KpisCard: painel lateral de "Clientes esfriando"', () => {
  it('enquanto a carteira carrega, o painel anuncia "Carregando clientes..." como status', async () => {
    vi.mocked(useClientesDaCarteira).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      isPlaceholderData: false,
    } as unknown as Retorno<typeof useClientesDaCarteira>);
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver clientes esfriando: 3' }));

    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Carregando clientes...');
  });

  it('o resumo conta as linhas da lista quando ela difere do total do indicador', async () => {
    vi.mocked(useKpis).mockReturnValue(
      consulta({ ...KPIS, inativos: { ...KPIS.inativos, total: 5 } }) as unknown as Retorno<typeof useKpis>,
    );
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver clientes esfriando: 5' }));

    const painel = screen.getByRole('dialog', { name: 'Clientes esfriando' });
    expect(within(painel).getAllByRole('listitem')).toHaveLength(3);
    expect(painel).toHaveAccessibleDescription('3 clientes · laranja e vermelho, hoje');
  });

  it('o cartão "Clientes esfriando" é um botão que abre o painel com os laranja e vermelhos, do mais urgente ao menos', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    // A carteira só é pedida quando o painel abre.
    expect(useClientesDaCarteira).not.toHaveBeenCalled();

    const botao = screen.getByRole('button', { name: 'Ver clientes esfriando: 3' });
    expect(botao).toHaveTextContent('3');
    await usuario.click(botao);

    expect(useClientesDaCarteira).toHaveBeenCalledWith('u1');
    const painel = screen.getByRole('dialog', { name: 'Clientes esfriando' });
    expect(painel).toHaveAccessibleDescription('3 clientes · laranja e vermelho, hoje');
    const linhas = within(painel).getAllByRole('listitem');
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      'Armazém NovoJoinville · Nunca visitado',
      'Empório SulJoinville · Atrasado · 35 dias sem visita',
      'Café CentralJoinville · Vencendo · 20 dias sem visita',
    ]);
    expect(within(linhas[0]).getByRole('link', { name: /Armazém Novo/ })).toHaveAttribute('href', '/clientes/c4');

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('os quatro indicadores são botões, na ordem do cartão', () => {
    renderizar();

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getAllByRole('term').map((termo) => termo.textContent)).toEqual([
      'Número de visitas',
      'Clientes visitados',
      'Conversão em vendas',
      'Clientes esfriando',
    ]);
  });
});

describe('os indicadores de visitas abrem o painel lateral', () => {
  it('só busca as visitas quando um painel abre', async () => {
    renderizar();
    expect(useVisitasDoPeriodo).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas do período: 12' }));

    expect(useVisitasDoPeriodo).toHaveBeenCalledWith(PERIODO_PADRAO, 'u1');
  });

  it('"Número de visitas" lista todas as visitas do período, com cliente, data e resultado', async () => {
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas do período: 12' }));

    const painel = screen.getByRole('dialog', { name: 'Número de visitas' });
    expect(painel).toHaveAccessibleDescription('6 visitas');
    const linhas = within(painel).getAllByRole('listitem');
    expect(linhas).toHaveLength(6);
    expect(linhas[0]).toHaveTextContent('Doceria Aurora');
    expect(linhas[0]).toHaveTextContent(/24\/10\/2026/);
    expect(linhas[0]).toHaveTextContent('Houve venda');
    expect(linhas[1]).toHaveTextContent('Em negociação');
    expect(linhas[3]).toHaveTextContent('Sem venda');
    expect(within(linhas[0]).getByRole('link', { name: 'Doceria Aurora' })).toHaveAttribute('href', '/clientes/c1');
  });

  it('"Clientes visitados" separa visitados (só ativos) de quem ficou sem visita no período', async () => {
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: /^Ver clientes visitados: 50/ }));

    const painel = screen.getByRole('dialog', { name: 'Clientes visitados' });
    expect(painel).toHaveAccessibleDescription('4 de 6 clientes com visita no período');
    expect(within(painel).getByRole('heading', { name: 'Visitados (4)' })).toBeInTheDocument();
    expect(within(painel).getByRole('heading', { name: 'Sem visita no período (2)' })).toBeInTheDocument();
    expect(within(painel).queryByText('Armazém Antigo')).not.toBeInTheDocument();
    expect(within(painel).getByText('Bom Doce')).toBeInTheDocument();
    expect(within(painel).getByText(/nunca visitado/)).toBeInTheDocument();
    expect(within(painel).getByText(/última visita há 80 dias/)).toBeInTheDocument();
    expect(within(painel).getByRole('link', { name: 'Empório Zeta' })).toHaveAttribute('href', '/clientes/n1');
  });

  it('"Conversão em vendas" lista as visitas com venda, com o valor em R$', async () => {
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: /^Ver visitas com venda: 42/ }));

    const painel = screen.getByRole('dialog', { name: 'Conversão em vendas' });
    expect(painel).toHaveAccessibleDescription('4 de 6 visitas com venda');
    const linhas = within(painel).getAllByRole('listitem');
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toHaveTextContent(reais(103.90));
    expect(linhas[3]).toHaveTextContent(reais(20.00));
  });

  it('mostra "Carregando..." enquanto o detalhe chega', async () => {
    vi.mocked(useVisitasDoPeriodo).mockReturnValue(
      consultaCarregando() as unknown as Retorno<typeof useVisitasDoPeriodo>,
    );
    renderizar();
    await userEvent.click(screen.getByRole('button', { name: 'Ver visitas do período: 12' }));

    expect(within(screen.getByRole('dialog')).getByRole('status')).toHaveTextContent('Carregando...');
  });

  it('Esc fecha o painel e devolve o foco ao cartão', async () => {
    renderizar();
    const botao = screen.getByRole('button', { name: 'Ver visitas do período: 12' });
    await userEvent.click(botao);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});
