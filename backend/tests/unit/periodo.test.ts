import { AppError } from '../../src/errors/AppError';
import { resolverPeriodo } from '../../src/services/periodo';

/** Meio-dia de São Paulo do dia dado, longe da virada do dia. */
function hoje(dia: string): Date {
  return new Date(`${dia}T12:00:00.000-03:00`);
}

function erroDe(funcao: () => unknown): AppError {
  try {
    funcao();
  } catch (erro) {
    return erro as AppError;
  }
  throw new Error('Esperava um erro, mas nada foi lançado.');
}

describe('resolverPeriodo', () => {
  it('sem período: 30 dias terminando hoje', () => {
    expect(resolverPeriodo({}, hoje('2026-10-25'))).toEqual({ dias: 30, inicio: '2026-09-26', fim: '2026-10-25' });
  });

  it('com periodoDias: a janela termina hoje', () => {
    expect(resolverPeriodo({ periodoDias: 90 }, hoje('2026-10-25'))).toEqual({
      dias: 90,
      inicio: '2026-07-28',
      fim: '2026-10-25',
    });
  });

  it('por datas: dias conta as duas pontas', () => {
    expect(resolverPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' }, hoje('2026-10-25'))).toEqual({
      dias: 25,
      inicio: '2026-10-01',
      fim: '2026-10-25',
    });
  });

  it('um dia só', () => {
    expect(resolverPeriodo({ inicio: '2026-10-25', fim: '2026-10-25' }, hoje('2026-10-25')).dias).toBe(1);
  });

  it('fim depois de hoje (em São Paulo) → 400', () => {
    const erro = erroDe(() => resolverPeriodo({ inicio: '2026-10-20', fim: '2026-10-26' }, hoje('2026-10-25')));

    expect(erro).toBeInstanceOf(AppError);
    expect(erro.statusCode).toBe(400);
    expect(erro.code).toBe('VALIDATION_ERROR');
    expect(erro.message).toBe('A data de fim não pode ser depois de hoje.');
  });

  it('às 22h de São Paulo (já dia seguinte em UTC), hoje ainda é o dia de São Paulo', () => {
    const noite = new Date('2026-10-25T22:00:00.000-03:00');

    expect(resolverPeriodo({ inicio: '2026-10-25', fim: '2026-10-25' }, noite).dias).toBe(1);
  });

  it('366 dias com limite 365 → 400 com a mensagem do limite; 365 dias passa', () => {
    const erro = erroDe(() =>
      resolverPeriodo({ inicio: '2025-10-25', fim: '2026-10-25' }, hoje('2026-10-25'), { limiteDias: 365 }),
    );

    expect(erro.statusCode).toBe(400);
    expect(erro.code).toBe('VALIDATION_ERROR');
    expect(erro.message).toBe('O período de visualização é de até 365 dias; para mais, use a Planilha.');
    expect(
      resolverPeriodo({ inicio: '2025-10-26', fim: '2026-10-25' }, hoje('2026-10-25'), { limiteDias: 365 }).dias,
    ).toBe(365);
  });

  it('a mensagem do limite usa o número do limite', () => {
    const erro = erroDe(() =>
      resolverPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' }, hoje('2026-10-25'), { limiteDias: 10 }),
    );

    expect(erro.message).toBe('O período de visualização é de até 10 dias; para mais, use a Planilha.');
  });

  it('sem limite, 400 dias passa', () => {
    expect(resolverPeriodo({ inicio: '2025-09-21', fim: '2026-10-25' }, hoje('2026-10-25')).dias).toBe(400);
  });
});
