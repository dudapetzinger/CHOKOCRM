import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AlertaProducao, Alertas } from '@/services/insights';
import { AlertasProducao } from './AlertasProducao';

const EVENTO = { id: 'e1', nome: 'Natal', dataEvento: '2026-12-25', diasAteEvento: 72 };

function cliente(id: string, nomeFantasia: string, quantidade: number) {
  return { id, nomeFantasia, cidade: 'Blumenau', quantidade, atualizadoEm: '2026-10-14T12:00:00.000Z' };
}

function alertas(lista: AlertaProducao[], indisponiveis = 0): Alertas {
  return {
    simulado: true,
    horizonteDias: 90,
    eventos: [],
    alertas: lista,
    clientesConsultados: 4,
    clientesIndisponiveis: indisponiveis,
  };
}

const DOIS_ALERTAS = alertas([
  {
    evento: EVENTO,
    produto: { sku: 'B1', nome: 'Bombons sortidos' },
    clientes: [cliente('c1', 'Empório do Vale', 0), cliente('c2', 'Café Blumenau', 4)],
  },
  {
    evento: EVENTO,
    produto: { sku: 'C1', nome: 'Caixa presente' },
    clientes: [cliente('c3', 'Mercado Central', 9)],
  },
]);

type Props = Partial<Parameters<typeof AlertasProducao>[0]>;

function renderizar(props: Props = {}) {
  const onHorizonteChange = vi.fn();
  render(
    <MemoryRouter>
      <AlertasProducao
        horizonteDias={90}
        onHorizonteChange={onHorizonteChange}
        alertas={DOIS_ALERTAS}
        carregando={false}
        erro={null}
        atualizando={false}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onHorizonteChange };
}

describe('AlertasProducao', () => {
  it('título e o segmentado "Próximos 30 · 60 · 90 · 180", com o horizonte atual marcado', async () => {
    const { onHorizonteChange } = renderizar();

    expect(screen.getByRole('heading', { level: 3, name: 'Alertas de produção' })).toBeInTheDocument();
    expect(screen.getByText('Próximos')).toBeInTheDocument();
    const segmentado = screen.getByRole('radiogroup', { name: 'Horizonte de eventos sazonais' });
    expect(within(segmentado).getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual([
      '30',
      '60',
      '90',
      '180',
    ]);
    expect(within(segmentado).getByRole('radio', { name: '90 dias' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(within(segmentado).getByRole('radio', { name: '180 dias' }));
    expect(onHorizonteChange).toHaveBeenCalledWith(180);
  });

  it('um item por alerta (produto, evento, prazo e clientes) e barra proporcional ao maior, sem a linha "Estoque baixo:"', () => {
    renderizar();

    const regiao = screen.getByRole('alert');
    const itens = within(regiao).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Bombons sortidos — Natal em 72 dias — 2 clientes');
    expect(itens[1]).toHaveTextContent('Caixa presente — Natal em 72 dias — 1 cliente');
    // Os clientes ficam só no balão da barra (e na tabela acessível), sem links.
    expect(screen.queryByText(/Estoque baixo:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    const barras = screen.getAllByTestId('barra-alerta');
    expect(barras.map((barra) => barra.style.width)).toEqual(['100%', '50%']);
  });

  it('focar a barra abre o balão com os clientes de estoque baixo e a quantidade de cada um', () => {
    renderizar();

    const barra = screen.getByRole('img', { name: 'Bombons sortidos — Natal · 2 clientes' });
    act(() => barra.focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Bombons sortidos — Natal · 2 clientes');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Empório do Vale · (0)',
      'Café Blumenau · (4)',
    ]);
    // O balão não fica dentro do `role="alert"`: abrir não é anunciado como alerta.
    expect(within(screen.getByRole('alert')).queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Caixa presente — Natal · 1 cliente' })).toBeInTheDocument();
  });

  it('a tabela acessível lista evento, produto e a coluna Clientes', () => {
    renderizar();

    const tabela = screen.getByRole('table', { name: 'Clientes com estoque baixo por alerta' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Evento',
      'Produto',
      'Clientes',
    ]);
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('Natal em 72 dias');
    expect(within(linhas[1]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      'Bombons sortidos',
      'Empório do Vale (0), Café Blumenau (4)',
    ]);
  });

  it('sem alertas, uma frase neutra que não interrompe o leitor de tela', () => {
    renderizar({ alertas: alertas([]) });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum alerta de produção para os próximos 90 dias.')).toBeInTheDocument();
  });

  it('com o ERP fora para todos os clientes, avisa que não deu para verificar', () => {
    renderizar({ alertas: alertas([], 4) });

    expect(screen.getByText(/Dados do ERP indisponíveis no momento/)).toBeInTheDocument();
  });

  it('com o ERP fora para parte dos clientes, diz para quantos', () => {
    renderizar({ alertas: { ...DOIS_ALERTAS, clientesIndisponiveis: 1 } });

    expect(screen.getByText('ERP indisponível para 1 de 4 clientes.')).toBeInTheDocument();
  });

  it('carregando e erro: o segmentado continua na tela para escolher outro horizonte', () => {
    renderizar({ alertas: undefined, carregando: true });
    expect(screen.getByText('Carregando alertas de produção...')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Horizonte de eventos sazonais' })).toBeInTheDocument();
  });

  it('com erro, o aviso aparece acima do resultado anterior, que continua visível', () => {
    renderizar({ erro: 'Você está sem internet.' });

    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Você está sem internet.');
    expect(within(screen.getByRole('list')).getByText('Bombons sortidos')).toBeInTheDocument();
  });
});
