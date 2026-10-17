import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmentado } from './Segmentado';

const opcoes = [
  { valor: 30, rotulo: '30', rotuloAcessivel: '30 dias' },
  { valor: 90, rotulo: '90 dias' },
  { valor: 365, rotulo: '365 dias' },
];

describe('Segmentado', () => {
  it('marca a opção atual e usa o rótulo acessível', () => {
    render(<Segmentado ariaLabel="Período" opcoes={opcoes} valor={30} onChange={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Período' })).toHaveClass('segmentado');
    expect(screen.getByRole('radio', { name: '30 dias' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '30 dias' })).toHaveTextContent('30');
    expect(screen.getByRole('radio', { name: '30 dias' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '90 dias' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: '90 dias' })).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight escolhe a próxima e move o foco', async () => {
    const onChange = vi.fn();
    render(<Segmentado ariaLabel="Período" opcoes={opcoes} valor={30} onChange={onChange} />);

    screen.getByRole('radio', { name: '30 dias' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenCalledWith(90);
    expect(screen.getByRole('radio', { name: '90 dias' })).toHaveFocus();
  });

  it('ArrowLeft na primeira volta para a última', async () => {
    const onChange = vi.fn();
    render(<Segmentado ariaLabel="Período" opcoes={opcoes} valor={30} onChange={onChange} />);

    screen.getByRole('radio', { name: '30 dias' }).focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(onChange).toHaveBeenCalledWith(365);
    expect(screen.getByRole('radio', { name: '365 dias' })).toHaveFocus();
  });

  it('clicar chama onChange', async () => {
    const onChange = vi.fn();
    render(<Segmentado ariaLabel="Período" opcoes={opcoes} valor={30} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: '365 dias' }));

    expect(onChange).toHaveBeenCalledWith(365);
  });

  it('compacto acrescenta a classe .segmentado-compacto', () => {
    render(<Segmentado ariaLabel="Período" opcoes={opcoes} valor={30} onChange={vi.fn()} compacto />);

    expect(screen.getByRole('radiogroup', { name: 'Período' })).toHaveClass('segmentado', 'segmentado-compacto');
  });
});
