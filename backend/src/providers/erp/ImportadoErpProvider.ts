import * as erpSaleRepository from '../../repositories/erp-sale.repository';
import type { NotaParaVenda } from '../../repositories/erp-sale.repository';
import {
  colunaDateDaData,
  dataCalendario,
  dataDaColunaDate,
  inicioDoDia,
} from '../../services/classificacao.service';
import type { ErpProvider, Period, Sale, StockSnapshot, Volume } from './ErpProvider';

/**
 * Provedor de ERP real da Etapa 12b: as vendas são as notas fiscais (DANFEs
 * em PDF) que o gestor importa (`ErpSale`), lidas pelo CNPJ do destinatário
 * — a chave do cliente neste provedor (ver `erp.service.chaveDoCliente`).
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
    const notas = await erpSaleRepository.listarNotasDoCnpj(cnpj, { limite });
    return notas.map(paraVenda);
  }

  async getSales(cnpj: string, period: Period): Promise<Sale[]> {
    const notas = await erpSaleRepository.listarNotasDoCnpj(cnpj, diasDoPeriodo(period));
    return notas.map(paraVenda);
  }

  async getPurchaseVolume(cnpj: string, period: Period): Promise<Volume> {
    const { de, ate } = diasDoPeriodo(period);
    const { total, quantidade } = await erpSaleRepository.somarNotasDoCnpj(cnpj, de, ate);
    return { total: total ? total.toNumber() : 0, quantidadeVendas: quantidade };
  }

  async getStockHistory(_cnpj: string): Promise<StockSnapshot[]> {
    return [];
  }
}

/**
 * O período (instantes locais inclusivos montados por `erp.service`) como
 * os dias de calendário das colunas `@db.Date`: uma nota emitida no último
 * dia do período conta.
 */
function diasDoPeriodo(period: Period): { de: Date; ate: Date } {
  return {
    de: colunaDateDaData(dataCalendario(period.inicio)),
    ate: colunaDateDaData(dataCalendario(period.fim)),
  };
}

/**
 * Nota como `Sale`. A data vira o início do dia de emissão no fuso do
 * sistema (a coluna `@db.Date` vem como meia-noite UTC, que em São Paulo
 * ainda é o dia anterior): `dataCalendario(venda.data)` dá o dia da nota.
 */
function paraVenda(nota: NotaParaVenda): Sale {
  return {
    data: inicioDoDia(dataDaColunaDate(nota.dataEmissao)),
    valor: nota.valorTotal.toNumber(),
    produtos: nota.itens.map((item) => ({
      sku: item.produtoCodigo,
      nome: item.produtoNome,
      quantidade: item.quantidade.toNumber(),
    })),
  };
}
