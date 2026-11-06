import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { listClients } from '../../services/clients';
import { BotaoCheckIn } from './BotaoCheckIn';

vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  listClients: vi.fn(async () => []),
}));

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BotaoCheckIn representanteId="u1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.mocked(listClients).mockClear();
});

describe('BotaoCheckIn', () => {
  it('botão "Novo check-in" com o rótulo "Check-in", sem buscar a carteira antes do toque', () => {
    renderizar();

    const botao = screen.getByRole('button', { name: 'Novo check-in' });
    expect(botao).toHaveAttribute('type', 'button');
    expect(botao).toHaveTextContent('Check-in');
    expect(botao).toHaveAttribute('aria-haspopup', 'dialog');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listClients).not.toHaveBeenCalled();
  });

  it('o toque abre "Para qual cliente?" com a carteira do representante; Esc fecha e o foco volta ao botão', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const botao = screen.getByRole('button', { name: 'Novo check-in' });

    await usuario.click(botao);
    expect(screen.getByRole('dialog', { name: 'Para qual cliente?' })).toBeInTheDocument();
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(listClients).toHaveBeenCalledWith({ representanteId: 'u1' });
    expect(screen.getByLabelText('Buscar cliente')).toHaveFocus();

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('tocar no fundo escurecido, fora do painel, fecha', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const botao = screen.getByRole('button', { name: 'Novo check-in' });

    await usuario.click(botao);
    await usuario.click(screen.getByTestId('fundo-do-seletor'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
});
