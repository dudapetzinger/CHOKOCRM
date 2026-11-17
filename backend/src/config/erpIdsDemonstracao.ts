/**
 * `erpId`s da demonstração: códigos numéricos de 5 dígitos, no formato do
 * cadastro de clientes do Senior X, calibrados para o ERP simulado (cor
 * composta com rebaixamento por última compra). O mock deriva o
 * perfil do cliente (`valorBase`, `mesesSemCompra`) do hash do texto do
 * `erpId` (`perfilDoErpId` em `providers/erp/mock/gerador.ts`); os códigos
 * foram escolhidos varrendo 10000..13000 com esse gerador e pegando, em ordem
 * crescente e sem sequência (como numeração de cadastro de verdade), um código
 * cujo `mesesSemCompra` produza o estado desejado de cada cliente:
 *
 * - Empório Pomerode → `10272` (`mesesSemCompra` 0): compra recente no ERP,
 *   a cor composta não é rebaixada.
 * - Armazém São Bento → `10745` (`mesesSemCompra` 3) e Hotel Fazenda Mulde →
 *   `12160` (`mesesSemCompra` 4), mais de 60 dias sem compra: os dois
 *   rebaixados para LARANJA mesmo com visita recente (um por representante),
 *   mostrando `rebaixadoPorVenda`.
 * - Doceria Jaraguá → `10448` (2): vencendo pela visita (LARANJA); com 2
 *   meses sem compra poderia ser rebaixada, mas já é LARANJA.
 * - Mercado Central Joinville → `10505` (0): em Atenção pela visita
 *   (AMARELO); com compra recente, nunca é rebaixado (com 1 mês sem compra,
 *   a última venda pode passar de 60 dias no fim de um mês de 31 dias).
 * - Empório do Vale Brusque → `10865` (0) e Casa de Chás Itajaí → `10947`
 *   (1): o estoque mais recente tem item BAIXO de
 *   Natal (`SKUS_SUGERIDOS.NATAL`) em todos os snapshots de 05 a 26/11/2026
 *   (o estoque do mock avança numa grade de 15 em 15 dias), para o insight de
 *   reposição sazonal.
 * - Mercearia Alto Vale → `11062` (0) e Padaria Confeitaria Indaial →
 *   `11143` (2): a Indaial nunca foi visitada (VERMELHO),
 *   cor que a compra não muda.
 * - Padaria Vale Europeu → `12168` e Confeitaria Rota das Cachoeiras →
 *   `12187` (`mesesSemCompra` 0; `valorBase` 1856 e 1740): todo cliente
 *   ativo da demonstração tem `erpId` (a tela "Sem histórico de compras"
 *   vale para cliente sem `erpId`). Códigos
 *   livres entre os dos âncoras e os dos gerados (de 12201).
 * - Café Beira-Rio → `12106` (`mesesSemCompra` 2): o cliente inativo do
 *   Rafael, fechado para reforma há mais de um mês, também parou de comprar
 *   no ERP; inativo, fica fora das abas de situação.
 * - Os demais (Café Blumenau, Cafeteria Estrada Bonita, Empório do Chocolate
 *   e os outros onze clientes): `mesesSemCompra` 0, para nenhum cliente
 *   em dia ser rebaixado sem querer; `valorBase` variado deixa o histórico de
 *   vendas da ficha diferente em cada um.
 *
 * Estes são os 26 clientes âncora; os gerados (`seed/clientes-gerados.ts`)
 * trazem o próprio `erpId`, escolhido com a mesma varredura a partir de
 * 12201, sempre com `mesesSemCompra` 0.
 *
 * Nenhum código termina em "-0" (`erpIdDesconhecido`): o caso
 * `NAO_ENCONTRADO` não está no seed (os testes o cobrem com ids próprios).
 */
export const ERP_IDS_DEMONSTRACAO: Record<string, string | null> = {
  'Empório Pomerode': '10272',
  'Café Blumenau': '10348',
  'Doceria Jaraguá': '10448',
  'Mercado Central Joinville': '10505',
  'Cafeteria Estrada Bonita': '10564',
  'Empório do Chocolate': '10683',
  'Armazém São Bento': '10745',
  'Empório do Vale Brusque': '10865',
  'Casa de Chás Itajaí': '10947',
  'Mercearia Alto Vale': '11062',
  'Padaria Confeitaria Indaial': '11143',
  'Confeitaria Dona Frida': '11202',
  'Café Rua das Palmeiras': '11264',
  'Mercearia Bom Retiro': '11369',
  'Panificadora Vila Lenzi': '11473',
  'Casa de Chá Recanto Alemão': '11534',
  'Hotel Fazenda Rio Novo': '11614',
  'Café Colonial Serra Alta': '11675',
  'Padaria Rainha da Serra': '11795',
  'Doceria Enxaimel': '11901',
  'Confeitaria Vila Germânica': '11959',
  'Empório Itoupava': '12024',
  'Café Beira-Rio': '12106',
  'Hotel Fazenda Mulde': '12160',
  'Padaria Vale Europeu': '12168',
  'Confeitaria Rota das Cachoeiras': '12187',
};

export const ERP_ID_EMPORIO = '10272';
export const ERP_ID_ARMAZEM = '10745';
