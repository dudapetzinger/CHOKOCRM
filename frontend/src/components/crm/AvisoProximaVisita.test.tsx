import type { ComponentProps } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '../../services/api';
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
  podeEditar = false,
  onSalvarData,
}: Partial<ComponentProps<typeof AvisoProximaVisita>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AvisoProximaVisita
        data={data}
        campanha={campanha}
        lembretes={lembretes}
        podeConcluir={podeConcluir}
        podeEditar={podeEditar}
        onSalvarData={onSalvarData}
      />
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

  describe('edição da data', () => {
    // Relógio fixo: as datas dos testes (2026-11-20, 2026-12-01) ficam sempre no futuro.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-03T15:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('com podeEditar e data, "Alterar data" abre o campo com a data e min de hoje', async () => {
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData: vi.fn() });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));

      const campo = screen.getByLabelText('Próxima visita');
      expect(campo).toHaveValue('2026-11-20');
      expect(campo).toHaveAttribute('type', 'date');
      expect(campo).toHaveAttribute('min', '2026-11-03');
      expect(screen.getByRole('button', { name: 'Limpar data' })).toBeInTheDocument();
    });

    it('sem data, mostra "Marcar próxima visita" mesmo sem campanha nem lembrete', async () => {
      const usuario = userEvent.setup({ delay: null });
      renderizar({ podeEditar: true, onSalvarData: vi.fn() });

      expect(screen.getByRole('note')).toBeInTheDocument();
      await usuario.click(screen.getByRole('button', { name: 'Marcar próxima visita' }));

      expect(screen.getByLabelText('Próxima visita')).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Limpar data' })).not.toBeInTheDocument();
    });

    it('sem podeEditar, não há botão de edição e sem data nada é desenhado', () => {
      const { container, unmount } = renderizar({ onSalvarData: vi.fn() });
      expect(container).toBeEmptyDOMElement();
      unmount();

      renderizar({ data: '2026-11-20', onSalvarData: vi.fn() });
      expect(screen.getByRole('note')).toHaveTextContent('Próxima visita: 20/11/2026');
      expect(screen.queryByRole('button', { name: 'Alterar data' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Marcar próxima visita' })).not.toBeInTheDocument();
    });

    it('Salvar chama onSalvarData com a data e fecha o campo', async () => {
      const onSalvarData = vi.fn().mockResolvedValue(undefined);
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));
      await usuario.clear(screen.getByLabelText('Próxima visita'));
      await usuario.type(screen.getByLabelText('Próxima visita'), '2026-12-01');
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(onSalvarData).toHaveBeenCalledWith('2026-12-01');
      await waitFor(() => expect(screen.queryByLabelText('Próxima visita')).not.toBeInTheDocument());
    });

    it('Limpar data chama onSalvarData(null) e fecha o campo', async () => {
      const onSalvarData = vi.fn().mockResolvedValue(undefined);
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));
      await usuario.click(screen.getByRole('button', { name: 'Limpar data' }));

      expect(onSalvarData).toHaveBeenCalledWith(null);
      await waitFor(() => expect(screen.queryByLabelText('Próxima visita')).not.toBeInTheDocument());
    });

    it('Salvar com o campo vazio não chama e mostra "Informe a data."', async () => {
      const onSalvarData = vi.fn().mockResolvedValue(undefined);
      const usuario = userEvent.setup({ delay: null });
      renderizar({ podeEditar: true, onSalvarData });

      await usuario.click(screen.getByRole('button', { name: 'Marcar próxima visita' }));
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(onSalvarData).not.toHaveBeenCalled();
      expect(screen.getByText('Informe a data.')).toBeInTheDocument();
      expect(screen.getByLabelText('Próxima visita')).toBeInTheDocument();
    });

    it('erro da API aparece no bloco e o campo continua aberto', async () => {
      const onSalvarData = vi.fn().mockRejectedValue(new ApiError('VALIDATION', 'A data não pode ser passada.'));
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('A data não pode ser passada.');
      expect(screen.getByLabelText('Próxima visita')).toBeInTheDocument();
    });

    it('data anterior a hoje, digitada à mão, não chama e mostra o aviso', async () => {
      const onSalvarData = vi.fn().mockResolvedValue(undefined);
      const usuario = userEvent.setup({ delay: null });
      renderizar({ podeEditar: true, onSalvarData });

      await usuario.click(screen.getByRole('button', { name: 'Marcar próxima visita' }));
      await usuario.type(screen.getByLabelText('Próxima visita'), '2020-01-02');
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(onSalvarData).not.toHaveBeenCalled();
      expect(screen.getByText('A próxima visita não pode ser antes de hoje.')).toBeInTheDocument();
    });

    it('o foco vai para o campo ao abrir e volta ao botão de edição ao cancelar', async () => {
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData: vi.fn() });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));
      expect(screen.getByLabelText('Próxima visita')).toHaveFocus();

      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('button', { name: 'Alterar data' })).toHaveFocus();
    });

    it('o foco volta ao botão de edição depois de salvar', async () => {
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData: vi.fn().mockResolvedValue(undefined) });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Alterar data' })).toHaveFocus());
    });

    it('Cancelar fecha sem chamar', async () => {
      const onSalvarData = vi.fn().mockResolvedValue(undefined);
      const usuario = userEvent.setup({ delay: null });
      renderizar({ data: '2026-11-20', podeEditar: true, onSalvarData });

      await usuario.click(screen.getByRole('button', { name: 'Alterar data' }));
      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(onSalvarData).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Próxima visita')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Alterar data' })).toBeInTheDocument();
    });
  });
});
