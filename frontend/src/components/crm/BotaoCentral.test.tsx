import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUp } from 'lucide-react';
import { BotaoCentral } from './BotaoCentral';

describe('BotaoCentral', () => {
  it('botão com nome acessível, rótulo visível e ícone decorativo', () => {
    const { container } = render(
      <BotaoCentral rotulo="Importar notas" ariaLabel="Importar notas" icone={FileUp} onClick={() => {}} />,
    );

    const botao = screen.getByRole('button', { name: 'Importar notas' });
    expect(botao).toHaveAttribute('type', 'button');
    expect(botao).toHaveTextContent('Importar notas');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('o toque chama onClick', async () => {
    const onClick = vi.fn();
    render(<BotaoCentral rotulo="Check-in" ariaLabel="Novo check-in" icone={FileUp} onClick={onClick} />);

    await userEvent.click(screen.getByRole('button', { name: 'Novo check-in' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('repassa as propriedades de ARIA ao botão', () => {
    render(
      <BotaoCentral
        rotulo="Check-in"
        ariaLabel="Novo check-in"
        icone={FileUp}
        onClick={() => {}}
        aria-haspopup="dialog"
        aria-expanded={false}
      />,
    );

    const botao = screen.getByRole('button', { name: 'Novo check-in' });
    expect(botao).toHaveAttribute('aria-haspopup', 'dialog');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
  });
});
