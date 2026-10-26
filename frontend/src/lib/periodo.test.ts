import {
  chaveDoPeriodo,
  diasDaFaixa,
  ehPersonalizado,
  LIMITE_DIAS_DO_PAINEL,
  MENSAGEM_LIMITE_DO_PAINEL,
  PERIODO_PADRAO,
  queryDoPeriodo,
} from './periodo';

describe('periodo', () => {
  it('o padrão é de 30 dias e o limite do Painel, 365', () => {
    expect(PERIODO_PADRAO).toEqual({ dias: 30 });
    expect(LIMITE_DIAS_DO_PAINEL).toBe(365);
    expect(MENSAGEM_LIMITE_DO_PAINEL).toBe('O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha.');
  });

  it('ehPersonalizado reconhece só a faixa com início e fim', () => {
    expect(ehPersonalizado({ dias: 90 })).toBe(false);
    expect(ehPersonalizado({ inicio: '2026-10-01', fim: '2026-10-25' })).toBe(true);
  });

  it('diasDaFaixa conta as duas pontas', () => {
    expect(diasDaFaixa('2026-10-01', '2026-10-25')).toBe(25);
    expect(diasDaFaixa('2026-10-25', '2026-10-25')).toBe(1);
    expect(diasDaFaixa('2025-10-26', '2026-10-25')).toBe(365);
    expect(diasDaFaixa('2025-10-25', '2026-10-25')).toBe(366);
  });

  it('chaveDoPeriodo: os dias ou "início_fim"', () => {
    expect(chaveDoPeriodo({ dias: 30 })).toBe('30');
    expect(chaveDoPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' })).toBe('2026-10-01_2026-10-25');
  });

  it('queryDoPeriodo manda só um dos dois formatos', () => {
    expect(queryDoPeriodo({ dias: 90 }).toString()).toBe('periodoDias=90');
    const personalizado = queryDoPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' });
    expect(personalizado.toString()).toBe('inicio=2026-10-01&fim=2026-10-25');
    expect(personalizado.has('periodoDias')).toBe(false);
  });
});
