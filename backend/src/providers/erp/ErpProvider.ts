/**
 * Contrato do provedor de ERP (Adapter) da Etapa 5. `MockErpProvider`
 * (Task 2) implementa esta interface simulando um ERP para demonstração;
 * um adapter real (ex.: integração com um ERP de verdade) implementaria a
 * mesma interface sem alterar services nem controllers — mesmo padrão
 * Adapter já usado por `FileStorage` (ver `storage/FileStorage.ts`).
 */
export type Sale = {
  data: Date;
  valor: number;
  produtos: { sku: string; nome: string; quantidade: number }[];
};

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

export interface ErpProvider {
  readonly simulado: boolean;
  getLastSale(clientErpId: string): Promise<Sale | null>;
  getSales(clientErpId: string, period: Period): Promise<Sale[]>;
  getPurchaseVolume(clientErpId: string, period: Period): Promise<Volume>;
  getStockHistory(clientErpId: string): Promise<StockSnapshot[]>;
}

/** Lançado pelo provedor de ERP quando a integração não pode responder. */
export class ErpIndisponivelError extends Error {
  constructor(message = 'Provedor de ERP indisponível.') {
    super(message);
    this.name = 'ErpIndisponivelError';
  }
}
