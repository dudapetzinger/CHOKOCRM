import * as erpSaleRepository from '../../repositories/erp-sale.repository';
import { decomporChaveHibrida } from './chave-hibrida';
import type { ErpProvider, Period, Sale, StockSnapshot, Volume } from './ErpProvider';
import type { ImportadoErpProvider } from './ImportadoErpProvider';
import type { MockErpProvider } from './MockErpProvider';

/**
 * Provedor de ERP `hibrido` (o padrão):
 * compõe o provedor das notas importadas e o simulado, com uma fonte por
 * cliente e nunca a soma das duas. A chave é a composta de `chave-hibrida.ts`
 * (`cnpj|erpId`, montada por `erp.service.chaveDoCliente`); a cada chamada,
 * uma consulta indexada de existência (`existeNotaDoCnpj`) decide: há nota
 * importada do CNPJ → `ImportadoErpProvider` com o CNPJ (notas + pedidos dos
 * check-ins sem nota, sem estoque); senão, com `erpId` → `MockErpProvider`
 * com o `erpId`; senão, vazio. Assim a primeira nota real de um cliente da
 * demonstração troca a fonte dele na hora.
 * `simulado` e `estoqueDisponivel` são as flags globais da interface: aqui
 * `false` e `true`; quem precisa saber do estoque de um cliente olha a fonte
 * dele (`erp.service.fonteDoCliente`) ou o histórico devolvido (vazio para
 * clientes com notas).
 */
export class HibridoErpProvider implements ErpProvider {
  readonly simulado = false;
  readonly estoqueDisponivel = true;

  constructor(
    private readonly importado: ImportadoErpProvider,
    private readonly mock: MockErpProvider,
  ) {}

  async getLastSale(chave: string): Promise<Sale | null> {
    return this.delegar(chave, (provedor, chaveDele) => provedor.getLastSale(chaveDele), null);
  }

  async getRecentSales(chave: string, limite: number): Promise<Sale[]> {
    return this.delegar(chave, (provedor, chaveDele) => provedor.getRecentSales(chaveDele, limite), []);
  }

  async getSales(chave: string, period: Period): Promise<Sale[]> {
    return this.delegar(chave, (provedor, chaveDele) => provedor.getSales(chaveDele, period), []);
  }

  async getPurchaseVolume(chave: string, period: Period): Promise<Volume> {
    return this.delegar(chave, (provedor, chaveDele) => provedor.getPurchaseVolume(chaveDele, period), {
      total: 0,
      quantidadeVendas: 0,
    });
  }

  async getStockHistory(chave: string): Promise<StockSnapshot[]> {
    return this.delegar(chave, (provedor, chaveDele) => provedor.getStockHistory(chaveDele), []);
  }

  /**
   * Escolhe o provedor do cliente da chave e repassa a chave dele (CNPJ às
   * notas, `erpId` ao simulado); sem nota e sem `erpId`, devolve `vazio`.
   */
  private async delegar<T>(
    chave: string,
    consultar: (provedor: ErpProvider, chaveDoProvedor: string) => Promise<T>,
    vazio: T,
  ): Promise<T> {
    const { cnpj, erpId } = decomporChaveHibrida(chave);
    if (await erpSaleRepository.existeNotaDoCnpj(cnpj)) {
      return consultar(this.importado, cnpj);
    }
    if (erpId) {
      return consultar(this.mock, erpId);
    }
    return vazio;
  }
}
