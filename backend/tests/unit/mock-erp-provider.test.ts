import { MockErpProvider } from '../../src/providers/erp/MockErpProvider';
import { ErpIndisponivelError } from '../../src/providers/erp/ErpProvider';
import { gerarHistoricoErp } from '../../src/providers/erp/mock/gerador';

const hoje = () => new Date('2026-09-29T15:00:00Z');
const erpId = 'ERP-1001';
const erpIdDesconhecido = 'ERP-1001-0';

const { vendas, estoque } = gerarHistoricoErp(erpId, hoje());

describe('MockErpProvider', () => {
  const provider = new MockErpProvider({ falhar: false }, hoje);

  it('simulado é true', () => {
    expect(provider.simulado).toBe(true);
  });

  it('getLastSale devolve a venda mais recente e null para erpId desconhecido', async () => {
    await expect(provider.getLastSale(erpId)).resolves.toEqual(vendas[0]);
    await expect(provider.getLastSale(erpIdDesconhecido)).resolves.toBeNull();
  });

  it('getSales filtra pelo período [inicio, fim]', async () => {
    const inicio = vendas[10]!.data;
    const fim = vendas[2]!.data;
    const esperado = vendas.filter((v) => v.data >= inicio && v.data <= fim);

    await expect(provider.getSales(erpId, { inicio, fim })).resolves.toEqual(esperado);
    expect(esperado.length).toBeGreaterThan(0);
  });

  it('getPurchaseVolume soma valor e conta vendas do período; zero para desconhecido', async () => {
    const inicio = vendas[10]!.data;
    const fim = vendas[2]!.data;
    const esperadas = vendas.filter((v) => v.data >= inicio && v.data <= fim);
    const total = esperadas.reduce((soma, v) => soma + v.valor, 0);

    await expect(provider.getPurchaseVolume(erpId, { inicio, fim })).resolves.toEqual({
      total,
      quantidadeVendas: esperadas.length,
    });

    await expect(
      provider.getPurchaseVolume(erpIdDesconhecido, { inicio, fim }),
    ).resolves.toEqual({ total: 0, quantidadeVendas: 0 });
  });

  it('getStockHistory devolve mais recente primeiro; vazio para desconhecido', async () => {
    await expect(provider.getStockHistory(erpId)).resolves.toEqual(estoque);
    await expect(provider.getStockHistory(erpIdDesconhecido)).resolves.toEqual([]);
  });

  it('com falhar: true todo método rejeita com ErpIndisponivelError', async () => {
    const providerIndisponivel = new MockErpProvider({ falhar: true }, hoje);
    const periodo = { inicio: hoje(), fim: hoje() };

    await expect(providerIndisponivel.getLastSale(erpId)).rejects.toBeInstanceOf(
      ErpIndisponivelError,
    );
    await expect(providerIndisponivel.getSales(erpId, periodo)).rejects.toBeInstanceOf(
      ErpIndisponivelError,
    );
    await expect(
      providerIndisponivel.getPurchaseVolume(erpId, periodo),
    ).rejects.toBeInstanceOf(ErpIndisponivelError);
    await expect(providerIndisponivel.getStockHistory(erpId)).rejects.toBeInstanceOf(
      ErpIndisponivelError,
    );
  });
});
