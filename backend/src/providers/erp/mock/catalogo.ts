/**
 * Catálogo fixo de produtos do ERP simulado: alimenta o gerador mock de
 * histórico de vendas e estoque e o pedido do check-in (`GET /erp/produtos`).
 * `precoUnitario` em reais, com no máximo 2 casas (cabe em `Decimal(10,2)`):
 * o check-in grava o preço do dia em cada item, então mudar um preço aqui não
 * muda pedido já registrado.
 */
export const CATALOGO: readonly { sku: string; nome: string; precoUnitario: number }[] = [
  { sku: 'TRUF-70', nome: 'Trufas 70% cacau', precoUnitario: 36 },
  { sku: 'BARRA-70', nome: 'Barra de chocolate 70% cacau', precoUnitario: 18 },
  { sku: 'BOMB-SORT', nome: 'Bombons sortidos', precoUnitario: 42 },
  { sku: 'OVO-PASCOA', nome: 'Ovo de Páscoa', precoUnitario: 55 },
  { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', precoUnitario: 48 },
  { sku: 'PAO-MEL', nome: 'Pães de mel', precoUnitario: 27.9 },
  { sku: 'DRAGEE', nome: 'Dragées de chocolate', precoUnitario: 24 },
  { sku: 'TAB-LEITE', nome: 'Tablete de chocolate ao leite', precoUnitario: 9 },
] as const;
