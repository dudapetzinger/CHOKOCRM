import { Prisma } from '@prisma/client';
import { somarItens } from '../../src/lib/somarItens';

function item(quantidade: number, precoUnitario: string) {
  return { quantidade, precoUnitario: new Prisma.Decimal(precoUnitario) };
}

describe('somarItens', () => {
  it('lista vazia soma zero', () => {
    expect(somarItens([]).toString()).toBe('0');
  });

  it('soma quantidade × preço em Decimal: 3 × 27,90 + 0,10 + 0,20 dá 84,00 exatos', () => {
    const total = somarItens([item(3, '27.90'), item(1, '0.10'), item(1, '0.20')]);

    expect(total.toString()).toBe('84');
    expect(total.toDecimalPlaces(2).toNumber()).toBe(84);
  });

  it('acumula sobre o valor inicial sem alterá-lo', () => {
    const inicial = new Prisma.Decimal('10.50');

    expect(somarItens([item(2, '12.50')], inicial).toString()).toBe('35.5');
    expect(inicial.toString()).toBe('10.5');
  });
});
