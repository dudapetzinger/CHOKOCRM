import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeletorRecorrencia } from './SeletorRecorrencia';

describe('SeletorRecorrencia', () => {
  it('clicar em "20 dias" chama onChange(20)', async () => {
    const onChange = vi.fn();
    render(<SeletorRecorrencia valor={15} onChange={onChange} id="dias" />);

    await userEvent.click(screen.getByRole('radio', { name: '20 dias' }));

    expect(onChange).toHaveBeenCalledWith(20);
  });

  it('valor fora de 15/20/30 abre com "Outro" ativo e o campo preenchido', () => {
    render(<SeletorRecorrencia valor={45} onChange={vi.fn()} id="dias" />);

    expect(screen.getByRole('radio', { name: 'Outro' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '15 dias' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('spinbutton')).toHaveValue(45);
  });

  it('clicar em "Outro" revela o campo com o valor atual e leva o foco a ele', async () => {
    const onChange = vi.fn();
    render(<SeletorRecorrencia valor={20} onChange={onChange} id="dias" />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Outro' }));

    const campo = screen.getByRole('spinbutton');
    expect(campo).toHaveValue(20);
    expect(campo).toHaveFocus();
    expect(campo).toHaveAttribute('min', '1');
    expect(campo).toHaveAttribute('max', '365');
  });

  it('digitar no campo "Outro" chama onChange com o número', () => {
    const onChange = vi.fn();
    render(<SeletorRecorrencia valor={45} onChange={onChange} id="dias" />);

    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '60' } });

    expect(onChange).toHaveBeenLastCalledWith(60);
  });
});
