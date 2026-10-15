import { render, screen, within } from '@testing-library/react';
import type { KpiRepresentante } from '../../services/dashboard';
import { GraficoVisitasPorRepresentante } from './GraficoVisitasPorRepresentante';

const DADOS: KpiRepresentante[] = [
  {
    id: 'u1',
    nome: 'Eduarda Fischer',
    clientesAtivos: 12,
    visitas: 5,
    conversaoEmVendas: { numerador: 2, denominador: 5, percentual: 40 },
  },
  {
    id: 'u2',
    nome: 'Rafael Schmitt',
    clientesAtivos: 9,
    visitas: 0,
    conversaoEmVendas: { numerador: 0, denominador: 0, percentual: null },
  },
];

describe('GraficoVisitasPorRepresentante', () => {
  it('resume os números em texto para leitores de tela', () => {
    render(<GraficoVisitasPorRepresentante dados={DADOS} largura={600} />);

    const figura = screen.getByRole('figure', { name: 'Visitas por representante no período' });
    expect(within(figura).getByRole('img')).toHaveAttribute(
      'aria-label',
      'Eduarda Fischer: 5 visitas, 40% com venda; Rafael Schmitt: sem visitas',
    );
  });

  it('traz uma tabela com uma linha por representante', () => {
    render(<GraficoVisitasPorRepresentante dados={DADOS} largura={600} />);

    const tabela = screen.getByRole('table');
    expect(tabela.closest('.visualmente-oculto')).not.toBeNull();
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3);
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('Eduarda Fischer');
    expect(within(linhas[1]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      '5',
      '40%',
    ]);
    expect(within(linhas[2]).getByRole('rowheader')).toHaveTextContent('Rafael Schmitt');
    expect(within(linhas[2]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      '0',
      'sem visitas',
    ]);
  });

  it('rotula cada barra com as visitas e a conversão', () => {
    const { container } = render(<GraficoVisitasPorRepresentante dados={DADOS} largura={600} />);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('5 visitas · 40% com venda')).toBeInTheDocument();
    expect(screen.getByText('sem visitas', { selector: 'text, tspan' })).toBeInTheDocument();
  });
});
