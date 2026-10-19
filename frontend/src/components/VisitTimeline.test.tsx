import { render, screen, within } from '@testing-library/react';
import type { Visita } from '../services/visits';
import { VisitTimeline } from './VisitTimeline';

function visita(sobrescrever: Partial<Visita>): Visita {
  return {
    id: 'v1',
    dataHora: '2026-10-18T13:00:00.000Z',
    descricao: 'Reposição do mostruário.',
    resultado: 'VENDA',
    contato: null,
    autor: { id: 'r1', nome: 'Eduarda Petzinger' },
    temFoto: false,
    criadoEm: '2026-10-18T13:00:00.000Z',
    editadoEm: null,
    itens: [],
    totalPedido: 0,
    ...sobrescrever,
  };
}

function renderizar(visitas: Visita[]) {
  render(
    <VisitTimeline visitas={visitas} usuarioId="outro" onEditarDescricao={vi.fn()} onAnexarFoto={vi.fn()} />,
  );
}

describe('VisitTimeline', () => {
  it('mostra o pedido da visita com o total e uma linha por item', () => {
    renderizar([
      visita({
        itens: [
          { sku: 'BOMB-SORT', produtoNome: 'Bombons sortidos', quantidade: 10, precoUnitario: 42 },
          { sku: 'PAO-MEL', produtoNome: 'Pães de mel', quantidade: 3, precoUnitario: 27.9 },
        ],
        totalPedido: 503.7,
      }),
    ]);

    const pedido = screen.getByRole('list', { name: /^Pedido · R\$\s503,70$/ });
    const linhas = within(pedido).getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('10× Bombons sortidos');
    expect(linhas[0]).toHaveTextContent('R$ 420,00');
    expect(linhas[1]).toHaveTextContent('3× Pães de mel');
    expect(linhas[1]).toHaveTextContent('R$ 83,70');
  });

  it('visita sem itens não mostra pedido', () => {
    renderizar([visita({ resultado: 'NEGOCIACAO' })]);

    expect(screen.getByText('Reposição do mostruário.')).toBeInTheDocument();
    expect(screen.queryByText(/^Pedido/)).not.toBeInTheDocument();
  });
});
