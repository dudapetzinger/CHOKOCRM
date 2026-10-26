import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MENSAGEM_LIMITE_DO_PAINEL, type Periodo } from '../lib/periodo';
import { FiltroPeriodo } from './FiltroPeriodo';

beforeEach(() => {
  // Só o relógio: "hoje" fixo em 25/10/2026, sem travar os timers do userEvent.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-25T15:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

function renderizar(valor: Periodo = { dias: 30 }) {
  const onChange = vi.fn();
  const onPeriodoDaPlanilha = vi.fn();
  render(<FiltroPeriodo valor={valor} onChange={onChange} onPeriodoDaPlanilha={onPeriodoDaPlanilha} />);
  return { onChange, onPeriodoDaPlanilha };
}

async function abrirPersonalizado(): Promise<void> {
  await userEvent.click(screen.getByRole('radio', { name: 'Personalizado' }));
}

function mudarData(rotulo: 'De' | 'Até', valor: string): void {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

describe('FiltroPeriodo', () => {
  it('renderiza o segmentado "30 dias", "90 dias", "365 dias" e "Personalizado", com a atual marcada', () => {
    renderizar();

    expect(screen.getByRole('radiogroup', { name: 'Período de análise dos indicadores' })).toBeInTheDocument();
    expect(screen.getByText('Período')).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual([
      '30 dias',
      '90 dias',
      '365 dias',
      'Personalizado',
    ]);
    expect(screen.getByRole('radio', { name: '30 dias' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '90 dias' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
  });

  it('clicar em "90 dias" chama onChange({ dias: 90 })', async () => {
    const { onChange } = renderizar();

    await userEvent.click(screen.getByRole('radio', { name: '90 dias' }));

    expect(onChange).toHaveBeenCalledWith({ dias: 90 });
  });

  it('com uma faixa como valor, "Personalizado" vem marcado, com as datas dela', () => {
    renderizar({ inicio: '2026-01-01', fim: '2026-03-31' });

    expect(screen.getByRole('radio', { name: 'Personalizado' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('De')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('Até')).toHaveValue('2026-03-31');
  });

  it('"Personalizado" mostra "De" e "Até" com a janela que estava marcada (30 dias: de hoje-29 a hoje)', async () => {
    const { onChange } = renderizar({ dias: 30 });

    await abrirPersonalizado();

    expect(screen.getByRole('radio', { name: 'Personalizado' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('De')).toHaveValue('2026-09-26');
    expect(screen.getByLabelText('Até')).toHaveValue('2026-10-25');
    expect(screen.getByLabelText('De')).toHaveAttribute('max', '2026-10-25');
    expect(screen.getByLabelText('Até')).toHaveAttribute('max', '2026-10-25');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a janela de 365 dias vira de hoje-364 a hoje', async () => {
    renderizar({ dias: 365 });

    await abrirPersonalizado();

    expect(screen.getByLabelText('De')).toHaveValue('2025-10-26');
  });

  it('datas válidas chamam onChange({ inicio, fim })', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('De', '2026-01-01');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ inicio: '2026-01-01', fim: '2026-10-25' });
    expect(onPeriodoDaPlanilha).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('365 dias exatos ainda é aceito', async () => {
    const { onChange } = renderizar();
    await abrirPersonalizado();

    mudarData('De', '2025-10-26');

    expect(onChange).toHaveBeenCalledWith({ inicio: '2025-10-26', fim: '2026-10-25' });
  });

  it('366 dias mostra a mensagem do limite, não chama onChange e manda o período à Planilha', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('De', '2025-10-25');

    expect(screen.getByRole('status')).toHaveTextContent(MENSAGEM_LIMITE_DO_PAINEL);
    expect(onChange).not.toHaveBeenCalled();
    expect(onPeriodoDaPlanilha).toHaveBeenCalledWith({ inicio: '2025-10-25', fim: '2026-10-25' });
  });

  it('faixa acima do limite e depois uma edição inválida: a Planilha não fica presa na faixa velha', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar({ dias: 90 });
    await abrirPersonalizado();

    mudarData('De', '2025-09-20');
    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ inicio: '2025-09-20', fim: '2026-10-25' });

    mudarData('De', '');

    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ dias: 90 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a mensagem do limite some quando a faixa volta a caber', async () => {
    const { onChange } = renderizar();
    await abrirPersonalizado();
    mudarData('De', '2025-10-25');

    mudarData('De', '2026-01-01');

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(onChange).toHaveBeenCalledWith({ inicio: '2026-01-01', fim: '2026-10-25' });
  });

  it('fim antes do início mostra o erro junto do campo, não chama onChange e a Planilha fica no período atual', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('Até', '2026-09-01');

    expect(screen.getByText('A data de fim deve ser depois do início.')).toBeInTheDocument();
    expect(screen.getByLabelText('Até')).toHaveAccessibleDescription('A data de fim deve ser depois do início.');
    expect(onChange).not.toHaveBeenCalled();
    // A Planilha volta ao período que o Painel está mostrando.
    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ dias: 30 });
  });

  it('apagar o "Até" mostra "Informe as duas datas." junto do campo e não troca o período do Painel', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('Até', '');

    expect(screen.getByLabelText('Até')).toHaveAccessibleDescription('Informe as duas datas.');
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('De')).not.toHaveAttribute('aria-invalid');
    expect(onChange).not.toHaveBeenCalled();
    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ dias: 30 });
  });

  it('o `valor` trocado por fora segue o período novo e esquece a edição (sem "Informe as duas datas.")', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<FiltroPeriodo valor={{ dias: 30 }} onChange={onChange} />);
    await abrirPersonalizado();
    mudarData('De', '');
    expect(screen.getByText('Informe as duas datas.')).toBeInTheDocument();

    rerender(<FiltroPeriodo valor={{ dias: 90 }} onChange={onChange} />);

    expect(screen.getByRole('radio', { name: '90 dias' })).toBeChecked();
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();

    rerender(<FiltroPeriodo valor={{ inicio: '2026-10-01', fim: '2026-10-20' }} onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'Personalizado' })).toBeChecked();
    expect(screen.getByLabelText('De')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('Até')).toHaveValue('2026-10-20');
    expect(screen.queryByText('Informe as duas datas.')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ao abrir "Personalizado" não há nenhum aviso: os campos já vêm preenchidos', async () => {
    renderizar();

    await abrirPersonalizado();

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByLabelText('De')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Até')).not.toHaveAttribute('aria-invalid');
  });

  it('apagar o "De" mostra "Informe as duas datas." junto do campo e não troca o período do Painel', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('De', '');

    expect(screen.getByText('Informe as duas datas.')).toBeInTheDocument();
    expect(screen.getByLabelText('De')).toHaveAccessibleDescription('Informe as duas datas.');
    expect(screen.getByLabelText('De')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Até')).not.toHaveAttribute('aria-invalid');
    expect(onChange).not.toHaveBeenCalled();
    // A Planilha volta ao período que o Painel está mostrando.
    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ dias: 30 });
  });

  it('"Até" depois de hoje mostra a mensagem junto do campo, não chama onChange e a Planilha fica no período atual', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('Até', '2026-10-26');

    expect(screen.getByLabelText('Até')).toHaveAccessibleDescription('A data não pode ser depois de hoje.');
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('De')).not.toHaveAttribute('aria-invalid');
    expect(onChange).not.toHaveBeenCalled();
    // A Planilha volta ao período que o Painel está mostrando.
    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ dias: 30 });
  });

  it('"De" depois de hoje mostra a mensagem no campo "De", não a de "fim antes do início"', async () => {
    const { onChange, onPeriodoDaPlanilha } = renderizar();
    await abrirPersonalizado();

    mudarData('De', '2026-10-30');

    expect(screen.getByLabelText('De')).toHaveAccessibleDescription('A data não pode ser depois de hoje.');
    expect(screen.queryByText('A data de fim deve ser depois do início.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Até')).not.toHaveAttribute('aria-invalid');
    expect(onChange).not.toHaveBeenCalled();
    // A Planilha volta ao período que o Painel está mostrando.
    expect(onPeriodoDaPlanilha).toHaveBeenLastCalledWith({ dias: 30 });
  });

  it('os dois campos podem ter erro ao mesmo tempo', async () => {
    renderizar();
    await abrirPersonalizado();

    mudarData('De', '2026-10-30');
    mudarData('Até', '2026-11-02');

    expect(screen.getByLabelText('De')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Até')).toHaveAttribute('aria-invalid', 'true');
  });

  it('a mensagem some quando a data volta a ser válida', async () => {
    const { onChange } = renderizar();
    await abrirPersonalizado();
    mudarData('Até', '2026-10-26');

    mudarData('Até', '2026-10-20');

    expect(screen.queryByText('A data não pode ser depois de hoje.')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith({ inicio: '2026-09-26', fim: '2026-10-20' });
  });

  it('voltar a "30 dias" some com os campos e chama onChange({ dias: 30 })', async () => {
    const { onChange } = renderizar();
    await abrirPersonalizado();

    await userEvent.click(screen.getByRole('radio', { name: '30 dias' }));

    expect(onChange).toHaveBeenCalledWith({ dias: 30 });
    expect(screen.queryByLabelText('De')).not.toBeInTheDocument();
  });
});
