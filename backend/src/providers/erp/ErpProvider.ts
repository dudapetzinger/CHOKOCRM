/**
 * Contrato do provedor de ERP (Adapter). Três implementações:
 * `MockErpProvider` simula um ERP para demonstração (chave = `erpId` do
 * cliente), `ImportadoErpProvider` lê as notas fiscais
 * importadas e os pedidos dos check-ins sem nota (chave = CNPJ do
 * cliente) e `HibridoErpProvider` compõe os dois por cliente (chave =
 * `cnpj|erpId`, ver `chave-hibrida.ts`: notas se há nota do CNPJ, senão o
 * simulado). Quem escolhe a chave é `erp.service.chaveDoCliente`; services e
 * controllers não mudam com o provedor (mesmo padrão Adapter de
 * `FileStorage`, ver `storage/FileStorage.ts`).
 */
/**
 * De onde veio a venda no provedor importado: uma nota fiscal importada
 * (pelo número) ou o pedido de um check-in VENDA ainda sem nota vinculada.
 * O mock não preenche.
 */
export type OrigemDaVenda = { tipo: 'nota'; numero: string } | { tipo: 'pedido'; visitaId: string };

export type Sale = {
  data: Date;
  valor: number;
  produtos: { sku: string; nome: string; quantidade: number }[];
  origem?: OrigemDaVenda;
};

/**
 * `inicio` e `fim` são instantes inclusivos, não uma janela de 24h por
 * `Date.now()`. Quem chama (`erp.service.ts`) monta os dois a partir de
 * dias de calendário inteiros (`inicio` é `00:00:00.000` local do
 * primeiro dia da janela, `fim` é `23:59:59.999` local do último), então
 * um adapter deve filtrar por `data >= inicio && data <= fim` sem
 * reinterpretar os limites como uma janela corrida de N×24h.
 */
export type Period = { inicio: Date; fim: Date };

export type Volume = { total: number; quantidadeVendas: number };

export type NivelEstoque = 'BAIXO' | 'NORMAL' | 'ALTO';

export type StockSnapshot = {
  data: Date;
  sku: string;
  nome: string;
  quantidade: number;
  nivel: NivelEstoque;
};

/**
 * `chave` é o identificador do cliente no provedor (`erpId` no mock, CNPJ
 * no importado, `cnpj|erpId` no híbrido). `getSales` devolve as vendas da mais recente para a mais
 * antiga. Sem estoque (`estoqueDisponivel = false`), `getStockHistory`
 * devolve sempre `[]`.
 */
export interface ErpProvider {
  readonly simulado: boolean;
  readonly estoqueDisponivel: boolean;
  getLastSale(chave: string): Promise<Sale | null>;
  /** As `limite` vendas mais recentes (sem período), da mais recente para a mais antiga. */
  getRecentSales(chave: string, limite: number): Promise<Sale[]>;
  getSales(chave: string, period: Period): Promise<Sale[]>;
  getPurchaseVolume(chave: string, period: Period): Promise<Volume>;
  getStockHistory(chave: string): Promise<StockSnapshot[]>;
}

/** Lançado pelo provedor de ERP quando a integração não pode responder. */
export class ErpIndisponivelError extends Error {
  constructor(message = 'Provedor de ERP indisponível.') {
    super(message);
    this.name = 'ErpIndisponivelError';
  }
}
