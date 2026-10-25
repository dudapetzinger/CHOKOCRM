import { dataDoEvento } from '../../src/config/sazonalidade';
import type { Sale } from '../../src/providers/erp/ErpProvider';
import { marcadoresDeEventos, mesesDaJanela, serieMensal, somarPorMes } from '../../src/services/vendas-mensais.regras';

/** Venda ao meio-dia em -03:00 do dia informado. */
function venda(dia: string, valor: number): Sale {
  return { data: new Date(`${dia}T12:00:00.000-03:00`), valor, produtos: [] };
}

describe('mesesDaJanela', () => {
  it("'2026-10-13' → 12 meses, de '2025-11' a '2026-10'", () => {
    const meses = mesesDaJanela('2026-10-13');

    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe('2025-11');
    expect(meses[11]).toBe('2026-10');
    expect(meses).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('quantidade menor e virada de ano', () => {
    expect(mesesDaJanela('2027-01-31', 3)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('somarPorMes', () => {
  const meses = ['2026-08', '2026-09', '2026-10'];

  it('soma vendas em dois meses, zera os meses sem venda e arredonda a 2 casas', () => {
    const resultado = somarPorMes(
      [venda('2026-08-03', 100.1), venda('2026-08-20', 200.2), venda('2026-10-01', 50)],
      meses,
    );

    expect(resultado).toEqual([
      { mes: '2026-08', total: 300.3 },
      { mes: '2026-09', total: 0 },
      { mes: '2026-10', total: 50 },
    ]);
  });

  it('venda fora dos meses da janela é ignorada', () => {
    expect(somarPorMes([venda('2026-07-31', 999)], meses).map((m) => m.total)).toEqual([0, 0, 0]);
  });

  it('mês pelo dia de calendário em America/Sao_Paulo: 01/09 01:00Z ainda é agosto', () => {
    const resultado = somarPorMes([{ data: new Date('2026-09-01T01:00:00.000Z'), valor: 10, produtos: [] }], meses);

    expect(resultado[0]).toEqual({ mes: '2026-08', total: 10 });
    expect(resultado[1]).toEqual({ mes: '2026-09', total: 0 });
  });
});

describe('serieMensal', () => {
  const doCliente = (id: string, nomeFantasia: string, vendas: Sale[]) => ({ cliente: { id, nomeFantasia }, vendas });

  it('soma todas as vendas e conta, por mês, os clientes com ao menos uma venda', () => {
    const resultado = serieMensal(
      [
        doCliente('c1', 'Doce Mel', [venda('2026-08-03', 10), venda('2026-08-10', 5), venda('2026-10-02', 1)]),
        doCliente('c2', 'Café Central', [venda('2026-08-15', 20)]),
        doCliente('c3', 'Mercado Sul', []),
      ],
      ['2026-08', '2026-09', '2026-10'],
    );

    expect(resultado.map(({ mes, total, clientesComDados }) => ({ mes, total, clientesComDados }))).toEqual([
      { mes: '2026-08', total: 35, clientesComDados: 2 },
      { mes: '2026-09', total: 0, clientesComDados: 0 },
      { mes: '2026-10', total: 1, clientesComDados: 1 },
    ]);
  });

  it('lista os clientes que compraram no mês, do maior total ao menor; mês sem venda fica com lista vazia', () => {
    const resultado = serieMensal(
      [
        doCliente('c1', 'Doce Mel', [venda('2026-08-03', 10), venda('2026-08-10', 5), venda('2026-10-02', 1)]),
        doCliente('c2', 'Café Central', [venda('2026-08-15', 20)]),
        doCliente('c3', 'Mercado Sul', []),
      ],
      ['2026-08', '2026-09', '2026-10'],
    );

    expect(resultado[0]!.clientes).toEqual([
      { id: 'c2', nomeFantasia: 'Café Central', total: 20 },
      { id: 'c1', nomeFantasia: 'Doce Mel', total: 15 },
    ]);
    expect(resultado[1]!.clientes).toEqual([]);
    expect(resultado[2]!.clientes).toEqual([{ id: 'c1', nomeFantasia: 'Doce Mel', total: 1 }]);
  });

  it('no empate de total, ordena pelo nome; soma do cliente em centavos', () => {
    const resultado = serieMensal(
      [
        doCliente('c1', 'Zeca Doces', [venda('2026-08-03', 0.1), venda('2026-08-04', 0.2)]),
        doCliente('c2', 'Açaí Bom', [venda('2026-08-05', 0.3)]),
      ],
      ['2026-08'],
    );

    expect(resultado[0]!.clientes).toEqual([
      { id: 'c2', nomeFantasia: 'Açaí Bom', total: 0.3 },
      { id: 'c1', nomeFantasia: 'Zeca Doces', total: 0.3 },
    ]);
  });

  it('venda fora dos meses pedidos não cria cliente em nenhum mês', () => {
    const resultado = serieMensal([doCliente('c1', 'Doce Mel', [venda('2025-01-10', 50)])], ['2026-08']);

    expect(resultado).toEqual([{ mes: '2026-08', total: 0, clientesComDados: 0, clientes: [] }]);
  });
});

describe('marcadoresDeEventos', () => {
  it("'2026-10-13': inclui Natal 2025 e Páscoa 2026, exclui Natal 2026; ordenados por data", () => {
    const marcadores = marcadoresDeEventos('2026-10-13');

    expect(marcadores).toContainEqual({ chave: 'NATAL', nome: 'Natal', data: dataDoEvento('NATAL', 2025) });
    expect(marcadores).toContainEqual({ chave: 'PASCOA', nome: 'Páscoa', data: dataDoEvento('PASCOA', 2026) });
    expect(marcadores.map((m) => m.data)).not.toContain(dataDoEvento('NATAL', 2026));
    expect(marcadores.map((m) => m.data)).toEqual([
      '2025-12-25',
      dataDoEvento('PASCOA', 2026),
      dataDoEvento('DIA_DAS_MAES', 2026),
      '2026-06-12',
      dataDoEvento('DIA_DOS_PAIS', 2026),
    ]);
    expect(marcadores.every((m) => m.data >= '2025-11-01' && m.data <= '2026-10-31')).toBe(true);
  });

  it('evento depois de hoje mas no mês corrente entra (Natal com hoje em 01/12)', () => {
    const marcadores = marcadoresDeEventos('2026-12-01');

    expect(marcadores.map((m) => m.chave)).toEqual(['PASCOA', 'DIA_DAS_MAES', 'NAMORADOS', 'DIA_DOS_PAIS', 'NATAL']);
    expect(marcadores.at(-1)?.data).toBe('2026-12-25');
    expect(marcadores.map((m) => m.data)).not.toContain('2025-12-25');
  });
});
