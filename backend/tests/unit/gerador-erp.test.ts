import {
  erpIdDesconhecido,
  perfilDoErpId,
  gerarHistoricoErp,
} from '../../src/providers/erp/mock/gerador';
import { ERP_ID_EMPORIO, ERP_ID_ARMAZEM } from '../../src/config/erpIdsDemonstracao';

const hoje = new Date('2026-09-29T15:00:00Z');

function acharErpIdComMesesSemCompra(mesesSemCompra: number): string {
  for (let n = 1001; n <= 1100; n++) {
    const erpId = `ERP-${n}`;
    if (perfilDoErpId(erpId).mesesSemCompra === mesesSemCompra) {
      return erpId;
    }
  }
  throw new Error(`Nenhum ERP-1001..1100 com mesesSemCompra === ${mesesSemCompra}`);
}

describe('gerarHistoricoErp', () => {
  it('mesmo erpId e mesmo dia produzem o mesmo histórico', () => {
    const a = gerarHistoricoErp('ERP-1001', hoje);
    const b = gerarHistoricoErp('ERP-1001', hoje);
    expect(a).toEqual(b);
  });

  it('erpIds diferentes produzem históricos diferentes', () => {
    const a = gerarHistoricoErp('ERP-1001', hoje);
    const b = gerarHistoricoErp('ERP-1002', hoje);
    expect(a).not.toEqual(b);
  });

  it('erpId terminado em -0 é desconhecido: sem vendas e sem estoque', () => {
    expect(erpIdDesconhecido('ERP-1230-0')).toBe(true);
    const { vendas, estoque } = gerarHistoricoErp('ERP-1230-0', hoje);
    expect(vendas).toEqual([]);
    expect(estoque).toEqual([]);
  });

  it('não há vendas nos últimos mesesSemCompra meses', () => {
    const erpId = acharErpIdComMesesSemCompra(3);
    const { vendas } = gerarHistoricoErp(erpId, hoje);
    const limite = new Date(hoje.getTime() - 60 * 86_400_000);
    expect(vendas[0]!.data.getTime()).toBeLessThan(limite.getTime());
  });

  it('vendas cobrem 24 meses, mais recente primeiro, valores > 0', () => {
    const erpId = acharErpIdComMesesSemCompra(0);
    const { vendas } = gerarHistoricoErp(erpId, hoje);

    expect(vendas.length).toBeGreaterThan(0);
    for (const venda of vendas) {
      expect(venda.valor).toBeGreaterThan(0);
    }

    const ordenadoPorDataDesc = [...vendas].sort((a, b) => b.data.getTime() - a.data.getTime());
    expect(vendas).toEqual(ordenadoPorDataDesc);

    const mesesCobertos = new Set(vendas.map((v) => v.data.toISOString().slice(0, 7)));
    expect(mesesCobertos.has('2024-10')).toBe(true); // 23 meses antes de 2026-09
  });

  it('mês pré-Páscoa vende mais que um mês comum do mesmo cliente', () => {
    const erpId = acharErpIdComMesesSemCompra(0);
    const { vendas } = gerarHistoricoErp(erpId, hoje);

    const somaMarco2026 = vendas
      .filter((v) => v.data.toISOString().slice(0, 7) === '2026-03')
      .reduce((soma, v) => soma + v.valor, 0);
    const somaSetembro2025 = vendas
      .filter((v) => v.data.toISOString().slice(0, 7) === '2025-09')
      .reduce((soma, v) => soma + v.valor, 0);

    expect(somaMarco2026).toBeGreaterThan(somaSetembro2025);
  });

  it('estoque tem 12 snapshots por produto, mais recente primeiro, com nível coerente com a quantidade', () => {
    const { estoque } = gerarHistoricoErp('ERP-1001', hoje);

    expect(estoque.length).toBe(12 * 8);

    const datasUnicas = new Set(estoque.map((s) => s.data.getTime()));
    expect(datasUnicas.size).toBe(12);

    for (const snapshot of estoque) {
      if (snapshot.quantidade < 10) {
        expect(snapshot.nivel).toBe('BAIXO');
      } else if (snapshot.quantidade < 40) {
        expect(snapshot.nivel).toBe('NORMAL');
      } else {
        expect(snapshot.nivel).toBe('ALTO');
      }
    }

    const ordenadoPorDataDesc = [...estoque].sort((a, b) => b.data.getTime() - a.data.getTime());
    expect(estoque).toEqual(ordenadoPorDataDesc);
  });

  it('erpIds do seed: Empório tem mesesSemCompra 0 e Armazém São Bento >= 3', () => {
    expect(perfilDoErpId(ERP_ID_EMPORIO).mesesSemCompra).toBe(0);
    expect(perfilDoErpId(ERP_ID_ARMAZEM).mesesSemCompra).toBeGreaterThanOrEqual(3);
  });
});
