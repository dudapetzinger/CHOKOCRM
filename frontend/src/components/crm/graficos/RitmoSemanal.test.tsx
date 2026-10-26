import { render, screen, within } from '@testing-library/react';
import type { FaixaDoRitmo } from '@/services/dashboard';
import { RitmoSemanal } from './RitmoSemanal';

const SEMANAS: FaixaDoRitmo[] = [
  { inicio: '2026-08-24', fim: '2026-08-30', parcial: false, visitas: 2, vendas: 1, clientes: [] },
  { inicio: '2026-08-31', fim: '2026-09-06', parcial: false, visitas: 0, vendas: 0, clientes: [] },
  { inicio: '2026-09-07', fim: '2026-09-13', parcial: false, visitas: 4, vendas: 2, clientes: [] },
  { inicio: '2026-09-14', fim: '2026-09-20', parcial: false, visitas: 8, vendas: 3, clientes: [] },
  { inicio: '2026-09-21', fim: '2026-09-27', parcial: false, visitas: 3, vendas: 0, clientes: [] },
  { inicio: '2026-09-28', fim: '2026-10-04', parcial: false, visitas: 5, vendas: 5, clientes: [] },
  { inicio: '2026-10-05', fim: '2026-10-11', parcial: false, visitas: 6, vendas: 2, clientes: [] },
  { inicio: '2026-10-12', fim: '2026-10-18', parcial: false, visitas: 1, vendas: 1, clientes: [] },
];

describe('RitmoSemanal', () => {
  it('uma coluna por semana, com a segunda-feira em dd/mm, e a nota que explica as duas partes', () => {
    render(<RitmoSemanal semanas={SEMANAS} />);

    expect(screen.getAllByTestId('barra-ritmo')).toHaveLength(8);
    for (const rotulo of ['24/08', '31/08', '07/09', '14/09', '21/09', '28/09', '05/10', '12/10']) {
      // O rótulo visível (a tabela acessível repete a data num <th>).
      expect(screen.getByText(rotulo, { selector: 'span' })).toBeInTheDocument();
    }
    expect(screen.getByText('Barra clara = visitas · parte escura = visitas com venda')).toBeInTheDocument();
  });

  it('tabela acessível com as 8 semanas, as visitas e as com venda', () => {
    render(<RitmoSemanal semanas={SEMANAS} />);

    const tabela = screen.getByRole('table', { name: 'Visitas por semana nas últimas 8 semanas' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(SEMANAS.length + 1);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Semana de',
      'Visitas',
      'Com venda',
    ]);
    expect(within(linhas[4]).getByRole('rowheader')).toHaveTextContent('14/09');
    expect(within(linhas[4]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual(['8', '3']);
  });

  it('a altura de cada barra segue as visitas (a maior ocupa a altura toda) e a parte escura, as vendas', () => {
    render(<RitmoSemanal semanas={SEMANAS} />);

    const barras = screen.getAllByTestId('barra-ritmo');
    expect(barras).toHaveLength(8);
    expect(barras[3]).toHaveStyle({ height: '100%' });
    expect(barras[0]).toHaveStyle({ height: '25%' });
    expect(within(barras[3]).getByTestId('parte-vendas')).toHaveStyle({ height: '37.5%' });
    expect(within(barras[5]).getByTestId('parte-vendas')).toHaveStyle({ height: '100%' });
  });
});
