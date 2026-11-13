import {
  ErpIndisponivelError,
  type ErpProvider,
  type Period,
  type Sale,
  type StockSnapshot,
  type Volume,
} from './ErpProvider';
import { gerarHistoricoErp } from './mock/gerador';
import { agora } from '../../lib/relogio';

/**
 * Implementação de demonstração de `ErpProvider`: gera um histórico
 * determinístico (ver `mock/gerador.ts`) a partir do `erpId` (a chave do
 * cliente no mock, ver `erp.service.chaveDoCliente`), sem tocar
 * banco de dados nem serviço externo. `falhar` simula a indisponibilidade
 * do ERP; `hoje` é injetado para os testes controlarem "agora"
 * sem mockar `Date` globalmente.
 */
export class MockErpProvider implements ErpProvider {
  readonly simulado = true;
  readonly estoqueDisponivel = true;

  private readonly falhar: boolean;
  private readonly hoje: () => Date;

  constructor(opcoes: { falhar: boolean } = { falhar: false }, hoje: () => Date = () => agora()) {
    this.falhar = opcoes.falhar;
    this.hoje = hoje;
  }

  async getLastSale(clientErpId: string): Promise<Sale | null> {
    this.verificarDisponibilidade();
    const { vendas } = gerarHistoricoErp(clientErpId, this.hoje());
    return vendas[0] ?? null;
  }

  async getRecentSales(clientErpId: string, limite: number): Promise<Sale[]> {
    this.verificarDisponibilidade();
    const { vendas } = gerarHistoricoErp(clientErpId, this.hoje());
    return vendas.slice(0, limite);
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
