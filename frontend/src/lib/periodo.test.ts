import {
  chaveDoPeriodo,
  diasDaFaixa,
  ehMesAtual,
  ehPersonalizado,
  faixaDoMesAtual,
  LIMITE_DIAS_DO_PAINEL,
  MENSAGEM_LIMITE_DO_PAINEL,
  PERIODO_PADRAO,
  queryDoPeriodo,
} from './periodo';

describe('periodo', () => {
  it('o padrão é o mês atual e o limite do Painel, 365', () => {
    expect(PERIODO_PADRAO).toEqual({ mes: 'ATUAL' });
    expect(LIMITE_DIAS_DO_PAINEL).toBe(365);
    expect(MENSAGEM_LIMITE_DO_PAINEL).toBe('O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha.');
  });

  it('ehMesAtual reconhece só o mês atual', () => {
    expect(ehMesAtual({ mes: 'ATUAL' })).toBe(true);
    expect(ehMesAtual({ dias: 30 })).toBe(false);
    expect(ehMesAtual({ inicio: '2026-10-01', fim: '2026-10-25' })).toBe(false);
  });

  it('faixaDoMesAtual vai do dia 1º do mês de hoje até hoje', () => {
    expect(faixaDoMesAtual('2026-10-25')).toEqual({ inicio: '2026-10-01', fim: '2026-10-25' });
    expect(faixaDoMesAtual('2026-12-01')).toEqual({ inicio: '2026-12-01', fim: '2026-12-01' });
  });

  it('ehPersonalizado reconhece só a faixa com início e fim', () => {
    expect(ehPersonalizado({ dias: 90 })).toBe(false);
    expect(ehPersonalizado({ mes: 'ATUAL' })).toBe(false);
    expect(ehPersonalizado({ inicio: '2026-10-01', fim: '2026-10-25' })).toBe(true);
  });

  it('diasDaFaixa conta as duas pontas', () => {
    expect(diasDaFaixa('2026-10-01', '2026-10-25')).toBe(25);
    expect(diasDaFaixa('2026-10-25', '2026-10-25')).toBe(1);
    expect(diasDaFaixa('2025-10-26', '2026-10-25')).toBe(365);
    expect(diasDaFaixa('2025-10-25', '2026-10-25')).toBe(366);
  });

  it('chaveDoPeriodo: "mes-atual", os dias ou "início_fim"', () => {
    expect(chaveDoPeriodo({ mes: 'ATUAL' })).toBe('mes-atual');
    expect(chaveDoPeriodo({ dias: 30 })).toBe('30');
    expect(chaveDoPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' })).toBe('2026-10-01_2026-10-25');
  });

  it('queryDoPeriodo manda só um dos dois formatos', () => {
    expect(queryDoPeriodo({ dias: 90 }).toString()).toBe('periodoDias=90');
    const personalizado = queryDoPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' });
    expect(personalizado.toString()).toBe('inicio=2026-10-01&fim=2026-10-25');
    expect(personalizado.has('periodoDias')).toBe(false);
  });

  it('queryDoPeriodo manda o mês atual como faixa, do dia 1º até hoje', () => {
    expect(queryDoPeriodo({ mes: 'ATUAL' }, '2026-11-22').toString()).toBe('inicio=2026-11-01&fim=2026-11-22');
  });

  it('queryDoPeriodo lê o hoje do relógio do sistema, no fuso de São Paulo', () => {
    // 02h UTC do dia 1º de dezembro ainda é 30 de novembro em São Paulo.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-12-01T02:00:00Z') });
    try {
      expect(queryDoPeriodo({ mes: 'ATUAL' }).toString()).toBe('inicio=2026-11-01&fim=2026-11-30');
    } finally {
      vi.useRealTimers();
    }
  });
});
