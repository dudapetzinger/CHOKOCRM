import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentadoResultado } from './SegmentadoResultado';

describe('SegmentadoResultado', () => {
  it('renderiza as três opções com a atual marcada', () => {
    render(<SegmentadoResultado valor="NEGOCIACAO" onChange={vi.fn()} />);

    const opcoes = screen.getAllByRole('radio');
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Venda', 'Negociação', 'Sem venda']);
    expect(screen.getByRole('radio', { name: 'Negociação' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Venda' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('clicar em "Sem venda" chama onChange("SEM_VENDA")', async () => {
    const onChange = vi.fn();
    render(<SegmentadoResultado valor="VENDA" onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Sem venda' }));

    expect(onChange).toHaveBeenCalledWith('SEM_VENDA');
  });

  it('seta para a direita passa para a próxima opção', async () => {
    const onChange = vi.fn();
    render(<SegmentadoResultado valor="VENDA" onChange={onChange} />);

    screen.getByRole('radio', { name: 'Venda' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith('NEGOCIACAO');
  });
});
