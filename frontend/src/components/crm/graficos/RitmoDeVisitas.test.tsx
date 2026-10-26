import { act, render, screen, within } from '@testing-library/react';
import type { FaixaDoRitmo, Ritmo } from '@/services/dashboard';
import { RitmoDeVisitas } from './RitmoDeVisitas';

function faixa(inicio: string, fim: string, visitas: number, vendas: number, extra: Partial<FaixaDoRitmo> = {}): FaixaDoRitmo {
  return { inicio, fim, parcial: false, visitas, vendas, clientes: [], ...extra };
}

const POR_SEMANA: Ritmo = {
  granularidade: 'SEMANA',
  faixas: [
    faixa('2026-09-14', '2026-09-20', 2, 1, { parcial: true }),
    faixa('2026-09-21', '2026-09-27', 8, 3),
    faixa('2026-09-28', '2026-10-04', 0, 0),
    faixa('2026-10-05', '2026-10-11', 6, 2, {
      clientes: [
        { id: 'c1', nomeFantasia: 'Doceria Aurora', visitas: 3, vendas: 2 },
        { id: 'c2', nomeFantasia: 'Café Central', visitas: 3, vendas: 0 },
      ],
    }),
    faixa('2026-10-12', '2026-10-18', 4, 4),
  ],
};

const MESES = [
  '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
];

const POR_MES: Ritmo = {
  granularidade: 'MES',
  faixas: MESES.map((mes, indice) =>
    faixa(`${mes}-${indice === 0 ? '26' : '01'}`, `${mes}-28`, indice === 12 ? 1 : 10, 0, {
      parcial: indice === 0 || indice === 12,
    }),
  ),
};

describe('RitmoDeVisitas', () => {
  it('por semana: uma coluna por faixa (5), com a segunda-feira em dd/mm, e a nota que explica as duas partes', () => {
    render(<RitmoDeVisitas ritmo={POR_SEMANA} />);

    expect(screen.getAllByTestId('barra-ritmo')).toHaveLength(5);
    for (const rotulo of ['14/09', '21/09', '28/09', '05/10', '12/10']) {
      // O rótulo visível (a tabela acessível repete a data num <th>).
      expect(screen.getByText(rotulo, { selector: 'span' })).toBeInTheDocument();
    }
    expect(screen.getByText('Barra clara = visitas · parte escura = visitas com venda')).toBeInTheDocument();
  });

  it('por mês: uma coluna por mês (13), com o mês curto embaixo', () => {
    render(<RitmoDeVisitas ritmo={POR_MES} />);

    expect(screen.getAllByTestId('barra-ritmo')).toHaveLength(13);
    expect(screen.getByText('out/25', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('out/26', { selector: 'span' })).toBeInTheDocument();
  });

  it('focar a coluna abre o balão com o resumo e os clientes, com "(venda)" nos que compraram', () => {
    render(<RitmoDeVisitas ritmo={POR_SEMANA} />);

    const coluna = screen.getByRole('img', { name: 'Semana de 05/10 · 6 visitas, 2 com venda' });
    act(() => coluna.focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Semana de 05/10 · 6 visitas, 2 com venda');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Doceria Aurora · (venda)',
      'Café Central',
    ]);
    expect(coluna).toHaveAccessibleDescription(/Doceria Aurora · \(venda\)/);
  });

  it('a faixa cortada pelo período diz "parcial" no título do balão', () => {
    render(<RitmoDeVisitas ritmo={POR_SEMANA} />);
    act(() => screen.getByRole('img', { name: /^Semana de 14\/09/ }).focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Semana de 14/09 · 2 visitas, 1 com venda · parcial');
  });

  it('por mês, o título do balão é o mês curto, no singular com uma visita', () => {
    render(<RitmoDeVisitas ritmo={POR_MES} />);
    act(() => screen.getByRole('img', { name: /^out\/26/ }).focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('out/26 · 1 visita, 0 com venda · parcial');
  });

  it('tabela acessível por semana, com a coluna Clientes', () => {
    render(<RitmoDeVisitas ritmo={POR_SEMANA} />);

    const tabela = screen.getByRole('table', { name: 'Visitas por semana no período' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(POR_SEMANA.faixas.length + 1);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Semana de',
      'Visitas',
      'Com venda',
      'Clientes',
    ]);
    expect(within(linhas[4]).getByRole('rowheader')).toHaveTextContent('05/10');
    expect(within(linhas[4]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      '6',
      '2',
      'Doceria Aurora, Café Central',
    ]);
  });

  it('tabela acessível por mês, com "Mês" na primeira coluna', () => {
    render(<RitmoDeVisitas ritmo={POR_MES} />);

    const tabela = screen.getByRole('table', { name: 'Visitas por mês no período' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(14);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Mês',
      'Visitas',
      'Com venda',
      'Clientes',
    ]);
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('out/25');
  });

  it('a altura de cada barra segue as visitas (a maior ocupa a altura toda) e a parte escura, as vendas', () => {
    render(<RitmoDeVisitas ritmo={POR_SEMANA} />);

    const barras = screen.getAllByTestId('barra-ritmo');
    expect(barras[1]).toHaveStyle({ height: '100%' });
    expect(barras[0]).toHaveStyle({ height: '25%' });
    expect(within(barras[1]).getByTestId('parte-vendas')).toHaveStyle({ height: '37.5%' });
    expect(within(barras[4]).getByTestId('parte-vendas')).toHaveStyle({ height: '100%' });
  });
});
