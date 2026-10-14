/**
 * `erpId`s calibrados para a demonstração da Etapa 5 (cor composta com
 * rebaixamento por última compra no ERP simulado). Os valores foram
 * escolhidos rodando `perfilDoErpId` (gerador determinístico do ERP mock)
 * sobre `ERP-1001..1060` e escolhendo, para cada cliente do seed, um id
 * cujo `mesesSemCompra` produza o estado desejado na demonstração:
 *
 * - Empório Pomerode → `ERP-1001` (`mesesSemCompra` 0): última compra
 *   recente no ERP, então a cor composta não é rebaixada — cliente
 *   permanece VERDE (mesma cor da regra de visitas da Etapa 4).
 * - Armazém São Bento → `ERP-1002` (`mesesSemCompra` 3, ou seja, mais de
 *   60 dias sem compra): dispara o rebaixamento para LARANJA mesmo tendo
 *   visita recente (VERDE pela Etapa 4), mostrando `rebaixadoPorVenda`.
 * - Café Blumenau, Doceria Jaraguá, Mercado Central Joinville e Cafeteria
 *   Estrada Bonita → `ERP-1003`, `ERP-1005`, `ERP-1006` e `ERP-1010`,
 *   perfis variados (2, 2, 1 e 1 meses sem compra) só para preencher o
 *   histórico de vendas/estoque exibido na ficha do cliente.
 * - Empório do Chocolate → `ERP-1000-0`: id terminado em "-0", portanto
 *   desconhecido no ERP simulado (`erpIdDesconhecido`) — a consulta
 *   retorna `NAO_ENCONTRADO`.
 * - Padaria Vale Europeu e Confeitaria Rota das Cachoeiras → sem `erpId`
 *   (`null`) — a consulta retorna `SEM_ERP_ID`.
 *
 * Carteira do Rafael (Etapa 7), calibrada com o mesmo gerador (o estoque do
 * mock avança numa grade de 15 em 15 dias, então "item baixo" vale para a
 * data da calibração; `ERP-1043` e `ERP-1026` seguiram baixos em Natal por
 * 20 dias seguidos):
 * - Empório do Vale Brusque → `ERP-1043` (`mesesSemCompra` 0): compra recente,
 *   então a visita AMARELA não é rebaixada; o estoque mais recente tem item
 *   BAIXO de Natal (SKUs de `SKUS_SUGERIDOS.NATAL`), bom para demonstrar o
 *   insight de reposição sazonal.
 * - Casa de Chás Itajaí → `ERP-1026` (`mesesSemCompra` 1): também com item
 *   BAIXO de Natal; a cor LARANJA da visita de 20 dias não muda com a
 *   compra.
 * - Mercearia Alto Vale → `ERP-1009` (`mesesSemCompra` 0) e Padaria
 *   Confeitaria Indaial → `ERP-1008` (`mesesSemCompra` 2): sem visita, logo
 *   VERMELHO; só preenchem o histórico da ficha.
 */
export const ERP_IDS_DEMONSTRACAO: Record<string, string | null> = {
  'Empório Pomerode': 'ERP-1001',
  'Armazém São Bento': 'ERP-1002',
  'Café Blumenau': 'ERP-1003',
  'Doceria Jaraguá': 'ERP-1005',
  'Mercado Central Joinville': 'ERP-1006',
  'Cafeteria Estrada Bonita': 'ERP-1010',
  'Empório do Chocolate': 'ERP-1000-0',
  'Padaria Vale Europeu': null,
  'Confeitaria Rota das Cachoeiras': null,
  'Empório do Vale Brusque': 'ERP-1043',
  'Casa de Chás Itajaí': 'ERP-1026',
  'Mercearia Alto Vale': 'ERP-1009',
  'Padaria Confeitaria Indaial': 'ERP-1008',
};

export const ERP_ID_EMPORIO = 'ERP-1001';
export const ERP_ID_ARMAZEM = 'ERP-1002';
