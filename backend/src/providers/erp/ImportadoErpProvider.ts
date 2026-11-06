import { somarItens } from '../../lib/somarItens';
import * as erpSaleRepository from '../../repositories/erp-sale.repository';
import type { NotaParaVenda } from '../../repositories/erp-sale.repository';
import * as visitRepository from '../../repositories/visit.repository';
import type { PedidoSemNota } from '../../repositories/visit.repository';
import {
  colunaDateDaData,
  dataCalendario,
  dataDaColunaDate,
  inicioDoDia,
} from '../../services/classificacao.service';
import type { ErpProvider, Period, Sale, StockSnapshot, Volume } from './ErpProvider';

/**
 * Provedor de ERP real da Etapa 12b: as vendas do cliente são as notas
 * fiscais (DANFEs em PDF) que o gestor importa (`ErpSale`), lidas pelo CNPJ
 * do destinatário — a chave do cliente neste provedor (ver
 * `erp.service.chaveDoCliente`) —, mais os pedidos dos check-ins sem nota:
 * visitas VENDA com itens e sem `erpSaleId` do cliente com esse CNPJ. A
 * visita já vinculada a uma nota não entra (os itens dela são os da nota),
 * nem a VENDA sem itens. Cada `Sale` diz a `origem` (nota pelo número ou
 * pedido pela visita), e a lista mesclada vai da mais recente para a mais
 * antiga (no mesmo instante, a nota antes). Mesclar aqui deixa coerentes
 * todos os consumidores do `erp.service` (ficha, insights, vendas mensais,
 * rebaixamento de cor) sem tocar neles.
 * Lê por CNPJ na hora da consulta, não pelo `clientId` gravado na
 * importação: a nota de um cliente cadastrado depois passa a contar.
 * As notas não trazem estoque: `estoqueDisponivel = false` e
 * `getStockHistory` devolve sempre `[]`.
 */
export class ImportadoErpProvider implements ErpProvider {
  readonly simulado = false;
  readonly estoqueDisponivel = false;

  async getLastSale(cnpj: string): Promise<Sale | null> {
    const [venda] = await this.getRecentSales(cnpj, 1);
    return venda ?? null;
  }

  async getRecentSales(cnpj: string, limite: number): Promise<Sale[]> {
    const [notas, pedidos] = await Promise.all([
      erpSaleRepository.listarNotasDoCnpj(cnpj, { limite }),
      visitRepository.listarPedidosSemNotaDoCnpj(cnpj, { limite }),
    ]);
    return mesclar(notas, pedidos).slice(0, limite);
  }

  async getSales(cnpj: string, period: Period): Promise<Sale[]> {
    const [notas, pedidos] = await Promise.all([
      erpSaleRepository.listarNotasDoCnpj(cnpj, diasDoPeriodo(period)),
      visitRepository.listarPedidosSemNotaDoCnpj(cnpj, period),
    ]);
    return mesclar(notas, pedidos);
  }

  async getPurchaseVolume(cnpj: string, period: Period): Promise<Volume> {
    const { de, ate } = diasDoPeriodo(period);
    const [notas, pedidos] = await Promise.all([
      erpSaleRepository.somarNotasDoCnpj(cnpj, de, ate),
      visitRepository.listarPedidosSemNotaDoCnpj(cnpj, period),
    ]);
    // Em Decimal até o fim: 100,10 + 103,80 não vira 203,89999….
    const total = pedidos.reduce((soma, pedido) => somarItens(pedido.itens, soma), notas.total ?? undefined);
    return {
      total: total ? total.toDecimalPlaces(2).toNumber() : 0,
      quantidadeVendas: notas.quantidade + pedidos.length,
    };
  }

  async getStockHistory(_cnpj: string): Promise<StockSnapshot[]> {
    return [];
  }
}

/**
 * O período (instantes locais inclusivos montados por `erp.service`) como
 * os dias de calendário das colunas `@db.Date`: uma nota emitida no último
 * dia do período conta. Os pedidos usam o período como veio (o instante do
 * check-in dentro de `[inicio, fim]`).
 */
function diasDoPeriodo(period: Period): { de: Date; ate: Date } {
  return {
    de: colunaDateDaData(dataCalendario(period.inicio)),
    ate: colunaDateDaData(dataCalendario(period.fim)),
  };
}

/**
 * Notas e pedidos numa lista só, da venda mais recente para a mais antiga.
 * A ordenação é estável e as notas entram primeiro: no mesmo instante, a
 * nota vem antes do pedido, e cada lista mantém a ordem do repositório.
 */
function mesclar(notas: NotaParaVenda[], pedidos: PedidoSemNota[]): Sale[] {
  return [...notas.map(notaParaVenda), ...pedidos.map(pedidoParaVenda)].sort(
    (a, b) => b.data.getTime() - a.data.getTime(),
  );
}

/**
 * Nota como `Sale`. A data vira o início do dia de emissão no fuso do
 * sistema (a coluna `@db.Date` vem como meia-noite UTC, que em São Paulo
 * ainda é o dia anterior): `dataCalendario(venda.data)` dá o dia da nota.
 */
function notaParaVenda(nota: NotaParaVenda): Sale {
  return {
    data: inicioDoDia(dataDaColunaDate(nota.dataEmissao)),
    valor: nota.valorTotal.toNumber(),
    produtos: nota.itens.map((item) => ({
      sku: item.produtoCodigo,
      nome: item.produtoNome,
      quantidade: item.quantidade.toNumber(),
    })),
    origem: { tipo: 'nota', numero: nota.numero },
  };
}

/** Pedido do check-in como `Sale`: o instante da visita e o total dos itens (em Decimal, arredondado aos centavos). */
function pedidoParaVenda(pedido: PedidoSemNota): Sale {
  return {
    data: pedido.dataHora,
    valor: somarItens(pedido.itens).toDecimalPlaces(2).toNumber(),
    produtos: pedido.itens.map((item) => ({
      sku: item.sku,
      nome: item.produtoNome,
      quantidade: item.quantidade,
    })),
    origem: { tipo: 'pedido', visitaId: pedido.id },
  };
}
