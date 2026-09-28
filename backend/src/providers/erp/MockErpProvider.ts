import {
  ErpIndisponivelError,
  type ErpProvider,
  type Period,
  type Sale,
  type StockSnapshot,
  type Volume,
} from './ErpProvider';
import { gerarHistoricoErp } from './mock/gerador';

/**
 * Implementação de demonstração de `ErpProvider`: gera um histórico
 * determinístico (ver `mock/gerador.ts`) a partir do `erpId`, sem tocar
 * banco de dados nem serviço externo. `falhar` simula a indisponibilidade
 * do ERP (UC11 E3); `hoje` é injetado para os testes controlarem "agora"
 * sem mockar `Date` globalmente.
 */
export class MockErpProvider implements ErpProvider {
  readonly simulado = true;

  private readonly falhar: boolean;
  private readonly hoje: () => Date;

  constructor(opcoes: { falhar: boolean } = { falhar: false }, hoje: () => Date = () => new Date()) {
    this.falhar = opcoes.falhar;
    this.hoje = hoje;
  }

  async getLastSale(clientErpId: string): Promise<Sale | null> {
    this.verificarDisponibilidade();
    const { vendas } = gerarHistoricoErp(clientErpId, this.hoje());
    return vendas[0] ?? null;
  }

  async getSales(clientErpId: string, period: Period): Promise<Sale[]> {
    this.verificarDisponibilidade();
    const { vendas } = gerarHistoricoErp(clientErpId, this.hoje());
    return vendas.filter((venda) => venda.data >= period.inicio && venda.data <= period.fim);
  }

  async getPurchaseVolume(clientErpId: string, period: Period): Promise<Volume> {
    this.verificarDisponibilidade();
    const { vendas } = gerarHistoricoErp(clientErpId, this.hoje());
    const vendasDoPeriodo = vendas.filter(
      (venda) => venda.data >= period.inicio && venda.data <= period.fim,
    );

    return {
      total: vendasDoPeriodo.reduce((soma, venda) => soma + venda.valor, 0),
      quantidadeVendas: vendasDoPeriodo.length,
    };
  }

  async getStockHistory(clientErpId: string): Promise<StockSnapshot[]> {
    this.verificarDisponibilidade();
    const { estoque } = gerarHistoricoErp(clientErpId, this.hoje());
    return estoque;
  }

  private verificarDisponibilidade(): void {
    if (this.falhar) {
      throw new ErpIndisponivelError();
    }
  }
}
