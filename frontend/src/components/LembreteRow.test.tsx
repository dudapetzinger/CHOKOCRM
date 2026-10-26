import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../services/api';
import { concluirLembrete, type LembreteItem } from '../services/lembretes';
import { LembreteRow } from './LembreteRow';
import { Toaster } from './ui/sonner';

vi.mock('../services/lembretes', () => ({ concluirLembrete: vi.fn(), listarLembretesDoCliente: vi.fn() }));

const LEMBRETE: LembreteItem = {
  id: 'l1',
  clienteId: 'c1',
  nomeFantasia: 'Doce Encanto',
  cidade: 'Blumenau',
  texto: 'Levar amostras de Natal',
  data: '2026-10-24',
  diasAtraso: 2,
  representante: { id: 'u2', nome: 'Rafael Schmitt' },
};

function renderizar({
  podeConcluir = false,
  mostrarRepresentante = false,
  ...mudancas
}: { podeConcluir?: boolean; mostrarRepresentante?: boolean } & Partial<LembreteItem> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ul>
          <LembreteRow
            lembrete={{ ...LEMBRETE, ...mudancas }}
            podeConcluir={podeConcluir}
            mostrarRepresentante={mostrarRepresentante}
          />
        </ul>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(concluirLembrete).mockReset();
});

describe('LembreteRow', () => {
  it('é um item de lista com o nome, o texto do lembrete e a linha "cidade · prazo"', () => {
    renderizar();

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getByText('Doce Encanto')).toBeInTheDocument();
    expect(screen.getByText('Levar amostras de Natal')).toBeInTheDocument();
    expect(screen.getByText('Blumenau · Lembrete venceu há 2 dias (24/10)')).toBeInTheDocument();
  });

  it('diz "para hoje", "venceu há 1 dia" no singular e "para dd/mm"', () => {
    const { unmount } = renderizar({ diasAtraso: 0, data: '2026-10-26' });
    expect(screen.getByText('Blumenau · Lembrete para hoje')).toBeInTheDocument();
    unmount();

    const segunda = renderizar({ diasAtraso: 1, data: '2026-10-25' });
    expect(screen.getByText('Blumenau · Lembrete venceu há 1 dia (25/10)')).toBeInTheDocument();
    segunda.unmount();

    renderizar({ diasAtraso: -3, data: '2026-10-29' });
    expect(screen.getByText('Blumenau · Lembrete para 29/10')).toBeInTheDocument();
  });

  it('o avatar (decorativo) e o nome levam para a ficha do cliente no mesmo link', () => {
    renderizar();

    const ficha = screen.getByRole('link', { name: /Doce Encanto/ });
    expect(ficha).toHaveAttribute('href', '/clientes/c1');
    expect(within(ficha).getByText('DE')).toHaveAttribute('aria-hidden', 'true');
  });

  it('mostra "Rep.:" só quando mostrarRepresentante', () => {
    const { unmount } = renderizar({ mostrarRepresentante: true });
    expect(screen.getByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    unmount();

    renderizar();
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });

  it('"Concluir" aparece só quando podeConcluir', () => {
    const { unmount } = renderizar({ podeConcluir: true });
    expect(
      screen.getByRole('button', { name: 'Concluir lembrete de Doce Encanto: Levar amostras de Natal' }),
    ).toHaveTextContent('Concluir');
    unmount();

    renderizar({ podeConcluir: false });
    expect(screen.queryByRole('button', { name: /Concluir/ })).not.toBeInTheDocument();
  });

  it('"Concluir" conclui o lembrete e avisa num toast', async () => {
    vi.mocked(concluirLembrete).mockResolvedValue({ id: 'l1', concluidoEm: '2026-10-26T12:00:00.000Z' });
    const usuario = userEvent.setup();
    renderizar({ podeConcluir: true });

    await usuario.click(screen.getByRole('button', { name: 'Concluir lembrete de Doce Encanto: Levar amostras de Natal' }));

    expect(concluirLembrete).toHaveBeenCalledWith('l1');
    expect(await screen.findByText('Lembrete concluído')).toBeInTheDocument();
  });

  it('depois de concluir, "Concluir" continua desabilitado até a linha sumir (toque duplo não dá 409)', async () => {
    vi.mocked(concluirLembrete).mockResolvedValue({ id: 'l1', concluidoEm: '2026-10-26T12:00:00.000Z' });
    const usuario = userEvent.setup();
    renderizar({ podeConcluir: true });

    const botao = screen.getByRole('button', { name: 'Concluir lembrete de Doce Encanto: Levar amostras de Natal' });
    await usuario.click(botao);
    expect(await screen.findByText('Lembrete concluído')).toBeInTheDocument();

    expect(botao).toBeDisabled();
    await usuario.click(botao);
    expect(concluirLembrete).toHaveBeenCalledTimes(1);
  });

  it('se não conclui, mostra o erro da API num toast', async () => {
    vi.mocked(concluirLembrete).mockRejectedValue(new ApiError('CONFLICT', 'Lembrete já concluído.'));
    const usuario = userEvent.setup();
    renderizar({ podeConcluir: true });

    await usuario.click(screen.getByRole('button', { name: 'Concluir lembrete de Doce Encanto: Levar amostras de Natal' }));

    expect(await screen.findByText('Lembrete já concluído.')).toBeInTheDocument();
  });

  it('"Concluir" fica desabilitado enquanto conclui', async () => {
    vi.mocked(concluirLembrete).mockReturnValue(new Promise(() => {}));
    const usuario = userEvent.setup();
    renderizar({ podeConcluir: true });

    const botao = screen.getByRole('button', { name: 'Concluir lembrete de Doce Encanto: Levar amostras de Natal' });
    await usuario.click(botao);

    expect(botao).toBeDisabled();
  });
});
