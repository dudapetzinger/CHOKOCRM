import { formatarPercentual } from './formatarPercentual';

describe('formatarPercentual', () => {
  it('número, espaço sem quebra e o sinal', () => {
    expect(formatarPercentual(70)).toBe('70 %');
    expect(formatarPercentual(0)).toBe('0 %');
    expect(formatarPercentual(100)).toBe('100 %');
  });
});
