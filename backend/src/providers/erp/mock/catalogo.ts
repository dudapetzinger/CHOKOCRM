/** Catálogo fixo de produtos usado pelo gerador mock de histórico de ERP. */
export const CATALOGO: readonly { sku: string; nome: string }[] = [
  { sku: 'TRUF-70', nome: 'Trufas 70% cacau' },
  { sku: 'BARRA-70', nome: 'Barra de chocolate 70% cacau' },
  { sku: 'BOMB-SORT', nome: 'Bombons sortidos' },
  { sku: 'OVO-PASCOA', nome: 'Ovo de Páscoa' },
  { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida' },
  { sku: 'PAO-MEL', nome: 'Pães de mel' },
  { sku: 'DRAGEE', nome: 'Dragées de chocolate' },
  { sku: 'TAB-LEITE', nome: 'Tablete de chocolate ao leite' },
] as const;
