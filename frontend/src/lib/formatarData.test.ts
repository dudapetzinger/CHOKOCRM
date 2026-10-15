import { formatarDiaMes, formatarMesCurto, mesAtual } from './formatarData';

describe('formatarMesCurto', () => {
  it('abrevia o mês em pt-BR, sem ponto, com o ano em dois dígitos', () => {
    expect(formatarMesCurto('2025-11')).toBe('nov/25');
    expect(formatarMesCurto('2026-03-15')).toBe('mar/26');
  });

  it('devolve a entrada como veio quando não é um mês válido', () => {
    expect(formatarMesCurto('2026-13')).toBe('2026-13');
    expect(formatarMesCurto('ontem')).toBe('ontem');
  });
});

describe('formatarDiaMes', () => {
  it('mostra dia e mês de uma data de calendário', () => {
    expect(formatarDiaMes('2026-09-07')).toBe('07/09');
  });
});

describe('mesAtual', () => {
  it('usa o mês local da data recebida', () => {
    expect(mesAtual(new Date(2026, 0, 31, 23, 30))).toBe('2026-01');
  });
});
