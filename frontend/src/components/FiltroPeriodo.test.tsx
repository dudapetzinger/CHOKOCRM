import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltroPeriodo } from './FiltroPeriodo';

describe('FiltroPeriodo', () => {
  it('renderiza as pílulas "30 dias", "90 dias" e "365 dias", com a ativa marcada', () => {
    render(<FiltroPeriodo valor={30} onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Período de análise dos indicadores' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((botao) => botao.textContent)).toEqual([
      '30 dias',
      '90 dias',
      '365 dias',
    ]);
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '90 dias' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar em "90 dias" chama onChange(90)', async () => {
    const onChange = vi.fn();
    render(<FiltroPeriodo valor={30} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '90 dias' }));

    expect(onChange).toHaveBeenCalledWith(90);
  });
});
