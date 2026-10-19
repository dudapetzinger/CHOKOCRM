import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Mock } from 'vitest';
import type { Produto } from '../../services/erp';
import type { ItemPedido } from '../../services/visits';
import { PedidoCampos } from './PedidoCampos';

const PRODUTOS: Produto[] = [
  { sku: 'BOMB-SORT', nome: 'Bombons sortidos', precoUnitario: 42 },
  { sku: 'BARRA-70', nome: 'Barra de chocolate 70% cacau', precoUnitario: 18 },
  { sku: 'PAO-MEL', nome: 'Pães de mel', precoUnitario: 27.9 },
];

let usuario: ReturnType<typeof userEvent.setup>;
let aoMudar: Mock<(itens: ItemPedido[]) => void>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  aoMudar = vi.fn();
});

/** O componente é controlado: o teste guarda os itens como a página faz. */
function PedidoControlado({ inicial }: { inicial: ItemPedido[] }) {
  const [itens, setItens] = useState(inicial);
  return (
    <PedidoCampos
      produtos={PRODUTOS}
      itens={itens}
      aoMudar={(novos) => {
        aoMudar(novos);
        setItens(novos);
      }}
    />
  );
}

function grupoPedido() {
  return screen.getByRole('group', { name: 'Pedido' });
}

describe('PedidoCampos', () => {
  it('mostra o total "R$ 420,00" para 10 × R$ 42,00', () => {
    render(<PedidoControlado inicial={[{ sku: 'BOMB-SORT', quantidade: 10 }]} />);

    expect(within(grupoPedido()).getByText('R$ 420,00')).toBeInTheDocument();
    const produto = screen.getByRole('combobox', { name: 'Produto do item 1' });
    expect(produto).toHaveDisplayValue(/^Bombons sortidos · R\$\s42,00$/);
    expect(screen.getByRole('spinbutton', { name: 'Quantidade do item 1' })).toHaveValue(10);
  });

  it('"Adicionar item" acrescenta uma linha e "Remover item" tira', async () => {
    render(<PedidoControlado inicial={[{ sku: 'BOMB-SORT', quantidade: 10 }]} />);

    await usuario.click(screen.getByRole('button', { name: 'Adicionar item' }));

    // A linha nova vem com o primeiro produto que ainda não está no pedido, sem quantidade
    expect(aoMudar).toHaveBeenLastCalledWith([
      { sku: 'BOMB-SORT', quantidade: 10 },
      { sku: 'BARRA-70', quantidade: 0 },
    ]);
    expect(screen.getAllByRole('button', { name: /^Remover item/ })).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Produto do item 2' })).toHaveFocus();

    await usuario.click(screen.getByRole('button', { name: 'Remover item 1' }));

    expect(aoMudar).toHaveBeenLastCalledWith([{ sku: 'BARRA-70', quantidade: 0 }]);
    expect(screen.getAllByRole('button', { name: /^Remover item/ })).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Produto do item 1' })).toHaveDisplayValue(
      /^Barra de chocolate 70% cacau · R\$\s18,00$/,
    );
    // O foco não se perde com o botão que sumiu
    expect(screen.getByRole('button', { name: 'Remover item 1' })).toHaveFocus();
  });

  it('remover a última linha leva o foco para "Adicionar item"', async () => {
    render(<PedidoControlado inicial={[{ sku: 'BOMB-SORT', quantidade: 10 }]} />);

    await usuario.click(screen.getByRole('button', { name: 'Remover item 1' }));

    expect(aoMudar).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('combobox', { name: /Produto do item/ })).not.toBeInTheDocument();
    expect(within(grupoPedido()).getByText('R$ 0,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar item' })).toHaveFocus();
  });

  it('trocar o produto e a quantidade refaz o total com o preço do catálogo', async () => {
    render(<PedidoControlado inicial={[{ sku: 'BOMB-SORT', quantidade: 10 }]} />);

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Produto do item 1' }), 'PAO-MEL');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantidade do item 1' }), { target: { value: '3' } });

    expect(aoMudar).toHaveBeenLastCalledWith([{ sku: 'PAO-MEL', quantidade: 3 }]);
    expect(within(grupoPedido()).getByText('R$ 83,70')).toBeInTheDocument();
  });

  it('quantidade apagada ou negativa vale 0 e aparece vazia', () => {
    render(<PedidoControlado inicial={[{ sku: 'BOMB-SORT', quantidade: 10 }]} />);
    const quantidade = screen.getByRole('spinbutton', { name: 'Quantidade do item 1' });

    fireEvent.change(quantidade, { target: { value: '' } });
    expect(aoMudar).toHaveBeenLastCalledWith([{ sku: 'BOMB-SORT', quantidade: 0 }]);
    expect(quantidade).toHaveValue(null);
    expect(quantidade).toHaveAttribute('placeholder', '0');

    fireEvent.change(quantidade, { target: { value: '-4' } });
    expect(aoMudar).toHaveBeenLastCalledWith([{ sku: 'BOMB-SORT', quantidade: 0 }]);
    expect(within(grupoPedido()).getByText('R$ 0,00')).toBeInTheDocument();
  });
});
