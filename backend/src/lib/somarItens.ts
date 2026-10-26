import { Prisma } from '@prisma/client';

/** Linha de pedido com o que a soma usa: a quantidade e o preço gravado no check-in. */
export type ItemSomavel = { quantidade: number; precoUnitario: Prisma.Decimal };

/**
 * Total de um pedido: a soma de `quantidade × precoUnitario` dos itens, em
 * `Decimal` (o tipo da coluna). Só quem mostra o valor converte para número,
 * no fim: em ponto flutuante, 3 × 27,90 daria 83,69999…. Lista vazia é zero.
 * `inicial` permite acumular pedidos de várias visitas na mesma soma.
 */
export function somarItens(itens: ItemSomavel[], inicial: Prisma.Decimal = new Prisma.Decimal(0)): Prisma.Decimal {
  return itens.reduce((soma, item) => soma.plus(item.precoUnitario.times(item.quantidade)), inicial);
}
