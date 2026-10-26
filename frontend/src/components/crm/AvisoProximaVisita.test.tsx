import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { concluirLembrete, type LembreteItem } from '../../services/lembretes';
import { AvisoProximaVisita } from './AvisoProximaVisita';

vi.mock('../../services/lembretes', () => ({ concluirLembrete: vi.fn(), listarLembretesDoCliente: vi.fn() }));

const VENCIDO: LembreteItem = {
  id: 'l1',
  clienteId: 'c1',
  nomeFantasia: 'Doces da Vovó',
  cidade: 'Joinville',
  texto: 'Levar amostras de Natal',
  data: '2026-10-24',
  diasAtraso: 2,
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
};

const ADIANTE: LembreteItem = { ...VENCIDO, id: 'l2', texto: 'Cobrar o boleto', data: '2026-10-30', diasAtraso: -4 };

function renderizar({
  data = null,
  campanha = null,
  lembretes = [],
  podeConcluir = false,
}: Partial<ComponentProps<typeof AvisoProximaVisita>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AvisoProximaVisita data={data} campanha={campanha} lembretes={lembretes} podeConcluir={podeConcluir} />
    </QueryClientProvider>,
  );
}

describe('AvisoProximaVisita', () => {
  it('mostra "Próxima visita: dd/mm/aaaa" e, abaixo, os lembretes com o texto e o prazo', () => {
    renderizar({ data: '2026-10-20', lembretes: [VENCIDO, ADIANTE] });

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 20/10/2026');
    const lista = within(aviso).getByRole('list', { name: 'Lembretes' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Levar amostras de Natal');
    expect(itens[0]).toHaveTextContent('venceu há 2 dias (24/10)');
    expect(itens[1]).toHaveTextContent('Cobrar o boleto');
    expect(itens[1]).toHaveTextContent('para 30/10');
  });

  it('só com lembretes (a data segue a recorrência), não mostra a linha da data', () => {
    renderizar({ lembretes: [VENCIDO] });

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Levar amostras de Natal');
    expect(aviso).not.toHaveTextContent('Próxima visita');
  });

  it('só com a data, não mostra a lista de lembretes', () => {
    renderizar({ data: '2026-12-01' });

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 01/12/2026');
    expect(within(aviso).queryByRole('list', { name: 'Lembretes' })).not.toBeInTheDocument();
  });

  it('mostra a etiqueta da campanha da próxima visita (spec 7.7)', () => {
    renderizar({ data: '2026-12-01', campanha: 'Natal Chokolaten' });

    const aviso = screen.getByRole('note');
    expect(within(aviso).getByText('Natal Chokolaten')).toBeInTheDocument();
    expect(aviso).toHaveTextContent('Campanha: Natal Chokolaten');
  });

  it('só com a campanha (a recorrência mudou e apagou a data), o aviso ainda aparece', () => {
    renderizar({ campanha: 'Natal Chokolaten' });

    expect(screen.getByRole('note')).toHaveTextContent('Natal Chokolaten');
    expect(screen.getByRole('note')).not.toHaveTextContent('Próxima visita');
  });

  it('sem data, campanha nem lembrete, não desenha nada', () => {
    const { container } = renderizar();

    expect(container).toBeEmptyDOMElement();
  });

  it('"Concluir" aparece em cada lembrete só quando podeConcluir', () => {
    const { unmount } = renderizar({ lembretes: [VENCIDO, ADIANTE], podeConcluir: true });
    expect(screen.getByRole('button', { name: 'Concluir lembrete: Levar amostras de Natal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir lembrete: Cobrar o boleto' })).toBeInTheDocument();
    unmount();

    renderizar({ lembretes: [VENCIDO, ADIANTE], podeConcluir: false });
    expect(screen.queryByRole('button', { name: /Concluir/ })).not.toBeInTheDocument();
  });

  it('"Concluir" conclui aquele lembrete', async () => {
    vi.mocked(concluirLembrete).mockResolvedValue({ id: 'l2', concluidoEm: '2026-10-26T12:00:00.000Z' });
    const usuario = userEvent.setup();
    renderizar({ lembretes: [VENCIDO, ADIANTE], podeConcluir: true });

    await usuario.click(screen.getByRole('button', { name: 'Concluir lembrete: Cobrar o boleto' }));

    expect(concluirLembrete).toHaveBeenCalledWith('l2');
  });
});
