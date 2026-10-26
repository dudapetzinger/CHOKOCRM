import { Prisma } from '@prisma/client';
import { produtosMaisVendidos, resultadosDaCampanha, statusDaCampanha } from '../../src/services/campaign.regras';

describe('statusDaCampanha (início e fim inclusivos, spec 7.7)', () => {
  const natal = { inicio: '2026-11-01', fim: '2026-12-24' };

  it('programada antes do início', () => {
    expect(statusDaCampanha(natal, '2026-10-31')).toBe('PROGRAMADA');
  });

  it('em andamento no dia do início', () => {
    expect(statusDaCampanha(natal, '2026-11-01')).toBe('EM_ANDAMENTO');
  });

  it('em andamento no meio do período', () => {
    expect(statusDaCampanha(natal, '2026-12-01')).toBe('EM_ANDAMENTO');
  });

  it('em andamento no dia do fim', () => {
    expect(statusDaCampanha(natal, '2026-12-24')).toBe('EM_ANDAMENTO');
  });

  it('encerrada no dia seguinte ao fim', () => {
    expect(statusDaCampanha(natal, '2026-12-25')).toBe('ENCERRADA');
  });

  it('evento de um dia só: em andamento só naquele dia', () => {
    const feira = { inicio: '2026-11-14', fim: '2026-11-14' };

    expect(statusDaCampanha(feira, '2026-11-13')).toBe('PROGRAMADA');
    expect(statusDaCampanha(feira, '2026-11-14')).toBe('EM_ANDAMENTO');
    expect(statusDaCampanha(feira, '2026-11-15')).toBe('ENCERRADA');
  });

  it('compara datas de calendário, não texto solto: virada de mês e de ano', () => {
    const virada = { inicio: '2026-12-31', fim: '2027-01-02' };

    expect(statusDaCampanha(virada, '2026-12-30')).toBe('PROGRAMADA');
    expect(statusDaCampanha(virada, '2027-01-01')).toBe('EM_ANDAMENTO');
    expect(statusDaCampanha(virada, '2027-01-03')).toBe('ENCERRADA');
  });
});

describe('resultadosDaCampanha (vendas e visitas vinculadas por representante)', () => {
  const EDUARDA = { id: 'r1', nome: 'Eduarda Fischer' };
  const RAFAEL = { id: 'r2', nome: 'Rafael Schmitt' };
  const ANA_INATIVA = { id: 'r3', nome: 'Ana Souza' };

  function item(quantidade: number, preco: string, sku = 'BOMB-SORT') {
    return { sku, produtoNome: `Produto ${sku}`, quantidade, precoUnitario: new Prisma.Decimal(preco) };
  }

  it('soma os pedidos das visitas com venda e conta todas as visitas, por autor', () => {
    const resultados = resultadosDaCampanha(
      [
        { autor: EDUARDA, clientId: 'c1', resultado: 'VENDA', itens: [item(10, '42'), item(3, '27.9')] },
        { autor: EDUARDA, clientId: 'c2', resultado: 'NEGOCIACAO', itens: [] },
        { autor: RAFAEL, clientId: 'c3', resultado: 'VENDA', itens: [item(2, '18')] },
      ],
      [EDUARDA, RAFAEL],
    );

    expect(resultados).toEqual([
      {
        representante: EDUARDA,
        vendas: 503.7,
        visitas: 2,
        clientesAtendidos: 2,
        conversao: { numerador: 1, denominador: 2, percentual: 50 },
      },
      {
        representante: RAFAEL,
        vendas: 36,
        visitas: 1,
        clientesAtendidos: 1,
        conversao: { numerador: 1, denominador: 1, percentual: 100 },
      },
    ]);
  });

  it('soma em Decimal: 3 × 27,90 dá 83,70, não 83,6999…', () => {
    const [linha] = resultadosDaCampanha(
      [
        { autor: EDUARDA, clientId: 'c1', resultado: 'VENDA', itens: [item(3, '27.9')] },
        { autor: EDUARDA, clientId: 'c1', resultado: 'VENDA', itens: [item(1, '0.1'), item(1, '0.2')] },
      ],
      [EDUARDA],
    );

    expect(linha!.vendas).toBe(84);
  });

  it('pedido de visita que não é venda não entra nas vendas (a visita conta)', () => {
    const [linha] = resultadosDaCampanha(
      [{ autor: EDUARDA, clientId: 'c1', resultado: 'SEM_VENDA', itens: [item(5, '10')] }],
      [EDUARDA],
    );

    expect(linha).toEqual({
      representante: EDUARDA,
      vendas: 0,
      visitas: 1,
      clientesAtendidos: 1,
      conversao: { numerador: 0, denominador: 1, percentual: 0 },
    });
  });

  it('representante sem visita vinculada aparece com zero e conversão sem percentual', () => {
    const resultados = resultadosDaCampanha([], [RAFAEL, EDUARDA]);
    const zerado = {
      vendas: 0,
      visitas: 0,
      clientesAtendidos: 0,
      conversao: { numerador: 0, denominador: 0, percentual: null },
    };

    expect(resultados).toEqual([
      { representante: EDUARDA, ...zerado },
      { representante: RAFAEL, ...zerado },
    ]);
  });

  it('autor fora da lista base (ex.: inativado) aparece se tem visita vinculada; a lista sai por nome', () => {
    const resultados = resultadosDaCampanha(
      [{ autor: ANA_INATIVA, clientId: 'c1', resultado: 'VENDA', itens: [item(1, '48')] }],
      [RAFAEL, EDUARDA],
    );

    expect(resultados.map((linha) => linha.representante.nome)).toEqual([
      'Ana Souza',
      'Eduarda Fischer',
      'Rafael Schmitt',
    ]);
    expect(resultados[0]).toEqual({
      representante: ANA_INATIVA,
      vendas: 48,
      visitas: 1,
      clientesAtendidos: 1,
      conversao: { numerador: 1, denominador: 1, percentual: 100 },
    });
  });

  it('duas visitas ao mesmo cliente contam um cliente atendido; clientes diferentes, um cada', () => {
    const [linha] = resultadosDaCampanha(
      [
        { autor: EDUARDA, clientId: 'c1', resultado: 'VENDA', itens: [item(1, '10')] },
        { autor: EDUARDA, clientId: 'c1', resultado: 'NEGOCIACAO', itens: [] },
        { autor: EDUARDA, clientId: 'c2', resultado: 'SEM_VENDA', itens: [] },
      ],
      [EDUARDA],
    );

    expect(linha!.visitas).toBe(3);
    expect(linha!.clientesAtendidos).toBe(2);
    expect(linha!.conversao).toEqual({ numerador: 1, denominador: 3, percentual: 33 });
  });

  it('o mesmo cliente visitado por dois representantes conta para cada um', () => {
    const resultados = resultadosDaCampanha(
      [
        { autor: EDUARDA, clientId: 'c1', resultado: 'VENDA', itens: [] },
        { autor: RAFAEL, clientId: 'c1', resultado: 'VENDA', itens: [] },
      ],
      [EDUARDA, RAFAEL],
    );

    expect(resultados.map((linha) => linha.clientesAtendidos)).toEqual([1, 1]);
  });
});

describe('produtosMaisVendidos (só visitas com VENDA)', () => {
  const EDUARDA = { id: 'r1', nome: 'Eduarda Fischer' };

  function venda(...itens: [sku: string, nome: string, quantidade: number, preco: string][]) {
    return {
      autor: EDUARDA,
      clientId: 'c1',
      resultado: 'VENDA' as const,
      itens: itens.map(([sku, produtoNome, quantidade, preco]) => ({
        sku,
        produtoNome,
        quantidade,
        precoUnitario: new Prisma.Decimal(preco),
      })),
    };
  }

  it('ignora o pedido de visita que não é venda', () => {
    const produtos = produtosMaisVendidos([
      venda(['BARRA-70', 'Barra 70%', 2, '18']),
      { ...venda(['BOMB-SORT', 'Bombons sortidos', 99, '42']), resultado: 'NEGOCIACAO' },
      { ...venda(['PAO-MEL', 'Pães de mel', 99, '27.9']), resultado: 'SEM_VENDA' },
    ]);

    expect(produtos).toEqual([{ sku: 'BARRA-70', nome: 'Barra 70%', quantidade: 2, total: 36 }]);
  });

  it('soma o mesmo SKU entre visitas, em Decimal e em reais com 2 casas', () => {
    const produtos = produtosMaisVendidos([
      venda(['PAO-MEL', 'Pães de mel', 3, '27.9']),
      venda(['PAO-MEL', 'Pães de mel', 1, '0.1'], ['BARRA-70', 'Barra 70%', 1, '18']),
    ]);

    expect(produtos).toEqual([
      { sku: 'PAO-MEL', nome: 'Pães de mel', quantidade: 4, total: 83.8 },
      { sku: 'BARRA-70', nome: 'Barra 70%', quantidade: 1, total: 18 },
    ]);
  });

  it('ordena por quantidade e total (decrescentes) e, no empate, por nome', () => {
    const produtos = produtosMaisVendidos([
      venda(
        ['A', 'Zeta', 5, '1'],
        ['B', 'Beta', 5, '3'],
        ['C', 'Alfa', 5, '1'],
        ['D', 'Maior quantidade', 9, '1'],
      ),
    ]);

    expect(produtos.map((p) => p.nome)).toEqual(['Maior quantidade', 'Beta', 'Alfa', 'Zeta']);
  });

  it('corta em 5 por padrão e aceita outro limite', () => {
    const visitas = [
      venda(
        ['P1', 'Produto 1', 1, '1'],
        ['P2', 'Produto 2', 2, '1'],
        ['P3', 'Produto 3', 3, '1'],
        ['P4', 'Produto 4', 4, '1'],
        ['P5', 'Produto 5', 5, '1'],
        ['P6', 'Produto 6', 6, '1'],
        ['P7', 'Produto 7', 7, '1'],
      ),
    ];

    expect(produtosMaisVendidos(visitas).map((p) => p.sku)).toEqual(['P7', 'P6', 'P5', 'P4', 'P3']);
    expect(produtosMaisVendidos(visitas, 2).map((p) => p.sku)).toEqual(['P7', 'P6']);
  });

  it('sem visitas, lista vazia', () => {
    expect(produtosMaisVendidos([])).toEqual([]);
  });
});
