import { render, screen, within } from '@testing-library/react';
import { TabelaAcessivel } from './TabelaAcessivel';

describe('TabelaAcessivel', () => {
  it('tabela com legenda, cabeçalhos de coluna e a primeira célula de cada linha como cabeçalho da linha', () => {
    render(
      <TabelaAcessivel
        legenda="Vendas por mês"
        colunas={['Mês', 'Vendas']}
        linhas={[
          ['set/26', 'R$ 1.000,00'],
          ['out/26', 'R$ 1.500,00'],
        ]}
      />,
    );

    const tabela = screen.getByRole('table', { name: 'Vendas por mês' });
    expect(within(tabela).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual(['Mês', 'Vendas']);
    expect(within(tabela).getAllByRole('rowheader').map((celula) => celula.textContent)).toEqual(['set/26', 'out/26']);
    expect(within(tabela).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      'R$ 1.000,00',
      'R$ 1.500,00',
    ]);
  });
});
