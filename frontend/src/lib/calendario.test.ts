import { chaveDoDia, diasDaGrade, hojeEmSaoPaulo, mesDaChave, somarMeses } from './calendario';

describe('diasDaGrade', () => {
  it('outubro de 2026 começa no domingo 27/09 e tem 42 dias, até 07/11', () => {
    const dias = diasDaGrade(new Date(2026, 9, 1));

    expect(dias).toHaveLength(42);
    expect(chaveDoDia(dias[0]!)).toBe('2026-09-27');
    expect(dias[0]!.getDay()).toBe(0);
    expect(chaveDoDia(dias[41]!)).toBe('2026-11-07');
  });

  it('mês que começa num domingo abre a grade no próprio dia 1', () => {
    const dias = diasDaGrade(new Date(2026, 10, 15));

    expect(chaveDoDia(dias[0]!)).toBe('2026-11-01');
  });
});

describe('datas do calendário', () => {
  it('o dia de hoje é o de São Paulo, não o do fuso do aparelho', () => {
    // 02:00 UTC de 20/10 ainda é 19/10 em São Paulo (-03:00)
    expect(hojeEmSaoPaulo(new Date('2026-10-20T02:00:00Z'))).toBe('2026-10-19');
  });

  it('mesDaChave e somarMeses trocam de mês e de ano', () => {
    expect(chaveDoDia(mesDaChave('2026-12-31'))).toBe('2026-12-01');
    expect(chaveDoDia(somarMeses(new Date(2026, 11, 1), 1))).toBe('2027-01-01');
    expect(chaveDoDia(somarMeses(new Date(2026, 0, 1), -1))).toBe('2025-12-01');
  });
});
