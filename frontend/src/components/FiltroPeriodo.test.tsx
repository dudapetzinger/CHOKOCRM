import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiltroPeriodo } from './FiltroPeriodo';

describe('FiltroPeriodo', () => {
  it('renderiza o segmentado "30 dias", "90 dias" e "365 dias", com a atual marcada', () => {
    render(<FiltroPeriodo valor={30} onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Período de análise dos indicadores' })).toBeInTheDocument();
    expect(screen.getByText('Período')).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual([
      '30 dias',
      '90 dias',
      '365 dias',
    ]);
    expect(screen.getByRole('radio', { name: '30 dias' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '90 dias' })).toHaveAttribute('aria-checked', 'false');
  });

  it('clicar em "90 dias" chama onChange(90)', async () => {
    const onChange = vi.fn();
    render(<FiltroPeriodo valor={30} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: '90 dias' }));

    expect(onChange).toHaveBeenCalledWith(90);
  });
});
