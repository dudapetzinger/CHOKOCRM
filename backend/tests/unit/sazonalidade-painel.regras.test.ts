import type { Sale } from '../../src/providers/erp/ErpProvider';
import { janelaDeVendas } from '../../src/services/insights.regras';
import {
  clientesComEstoqueBaixo,
  estoqueBaixoPorProduto,
  janelaAtualAteHoje,
  periodoQueCobre,
  totalDaCarteira,
  type ClienteComEstoqueInformado,
} from '../../src/services/sazonalidade-painel.regras';

/** Venda ao meio-dia em -03:00 do dia informado. */
function venda(dia: string, valor: number): Sale {
  return { data: new Date(`${dia}T12:00:00.000-03:00`), valor, produtos: [] };
}

function cliente(
  id: string,
  itensBaixos: { sku: string; nome: string; quantidade: number }[],
  cidade = 'Pomerode',
): ClienteComEstoqueInformado {
  return { id, nomeFantasia: `Cliente ${id}`, cidade, itensBaixos };
}

describe('janelaDeVendas', () => {
  it('vai de 30 dias antes da data até o próprio dia', () => {
    expect(janelaDeVendas({ dataEvento: '2026-12-25' })).toEqual({ inicio: '2026-11-25', fim: '2026-12-25' });
  });
});

describe('janelaAtualAteHoje', () => {
  const janela = { inicio: '2026-11-25', fim: '2026-12-25' };

  it('é null enquanto a janela não começou', () => {
    expect(janelaAtualAteHoje(janela, '2026-11-24')).toBeNull();
  });

  it('no primeiro dia da janela vai do início até hoje', () => {
    expect(janelaAtualAteHoje(janela, '2026-11-25')).toEqual({ inicio: '2026-11-25', fim: '2026-11-25' });
  });

  it('com a janela em curso termina hoje', () => {
    expect(janelaAtualAteHoje(janela, '2026-12-10')).toEqual({ inicio: '2026-11-25', fim: '2026-12-10' });
  });

  it('no dia da data é a janela inteira', () => {
    expect(janelaAtualAteHoje(janela, '2026-12-25')).toEqual(janela);
  });
});

describe('periodoQueCobre', () => {
  it('vai do início mais antigo ao fim mais recente', () => {
    expect(
      periodoQueCobre([
        { inicio: '2025-11-25', fim: '2025-12-25' },
        { inicio: '2026-01-15', fim: '2026-02-14' },
        { inicio: '2025-03-01', fim: '2025-03-31' },
      ]),
    ).toEqual({ inicio: '2025-03-01', fim: '2026-02-14' });
  });

  it('sem janela nenhuma lança erro', () => {
    expect(() => periodoQueCobre([])).toThrow();
  });
});

describe('totalDaCarteira', () => {
  const janela = { inicio: '2025-11-25', fim: '2025-12-25' };

  it('soma as vendas de todos os clientes dentro da janela, limites inclusivos, em centavos', () => {
    const vendasPorCliente = [
      [venda('2025-11-24', 1000), venda('2025-11-25', 100.105), venda('2025-12-25', 50)],
      [venda('2025-12-01', 0.2), venda('2025-12-26', 999)],
      [],
    ];

    expect(totalDaCarteira(vendasPorCliente, janela)).toBe(150.31);
  });

  it('sem cliente nenhum é zero', () => {
    expect(totalDaCarteira([], janela)).toBe(0);
  });

  it('sem janela é null', () => {
    expect(totalDaCarteira([[venda('2025-12-01', 10)]], null)).toBeNull();
  });
});

describe('estoqueBaixoPorProduto', () => {
  const nomes = new Map([
    ['CX-PRESENTE', 'Caixa presente'],
    ['BOMB-SORT', 'Bombons sortidos'],
  ]);

  it('agrupa por produto indicado, com os clientes da menor quantidade para a maior', () => {
    const resultado = estoqueBaixoPorProduto(['CX-PRESENTE', 'BOMB-SORT'], nomes, [
      cliente('a', [{ sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 7 }]),
      cliente('b', [
        { sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 2 },
        { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 9 },
      ]),
      cliente('c', []),
    ]);

    expect(resultado).toEqual([
      {
        sku: 'CX-PRESENTE',
        nome: 'Caixa presente',
        totalClientes: 2,
        clientes: [
          { id: 'b', nomeFantasia: 'Cliente b', cidade: 'Pomerode', quantidade: 2 },
          { id: 'a', nomeFantasia: 'Cliente a', cidade: 'Pomerode', quantidade: 7 },
        ],
      },
      {
        sku: 'BOMB-SORT',
        nome: 'Bombons sortidos',
        totalClientes: 1,
        clientes: [{ id: 'b', nomeFantasia: 'Cliente b', cidade: 'Pomerode', quantidade: 9 }],
      },
    ]);
  });

  it('ignora itens baixos de produtos que não são indicados para a data', () => {
    const resultado = estoqueBaixoPorProduto(['CX-PRESENTE'], nomes, [
      cliente('a', [{ sku: 'PAO-MEL', nome: 'Pão de mel', quantidade: 1 }]),
    ]);

    expect(resultado).toEqual([{ sku: 'CX-PRESENTE', nome: 'Caixa presente', totalClientes: 0, clientes: [] }]);
  });

  it('não repete o cliente no mesmo produto e fica com a menor quantidade', () => {
    const resultado = estoqueBaixoPorProduto(['CX-PRESENTE'], nomes, [
      cliente('a', [
        { sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 8 },
        { sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 3 },
      ]),
      cliente('a', [{ sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 5 }]),
    ]);

    expect(resultado[0]!.totalClientes).toBe(1);
    expect(resultado[0]!.clientes).toEqual([{ id: 'a', nomeFantasia: 'Cliente a', cidade: 'Pomerode', quantidade: 3 }]);
  });

  it('produto com mais clientes vem primeiro; no empate, pelo nome', () => {
    const resultado = estoqueBaixoPorProduto(['CX-PRESENTE', 'BOMB-SORT', 'TRUF-70'], new Map(), [
      cliente('a', [
        { sku: 'TRUF-70', nome: 'Trufas 70%', quantidade: 1 },
        { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 1 },
      ]),
      cliente('b', [{ sku: 'TRUF-70', nome: 'Trufas 70%', quantidade: 4 }]),
    ]);

    expect(resultado.map(({ sku }) => sku)).toEqual(['TRUF-70', 'BOMB-SORT', 'CX-PRESENTE']);
  });

  it('no empate de quantidade, os clientes vão pelo nome', () => {
    const resultado = estoqueBaixoPorProduto(['CX-PRESENTE'], nomes, [
      { id: 'z', nomeFantasia: 'Zeca Doces', cidade: 'Blumenau', itensBaixos: [{ sku: 'CX-PRESENTE', nome: 'x', quantidade: 4 }] },
      { id: 'y', nomeFantasia: 'Armazem', cidade: 'Blumenau', itensBaixos: [{ sku: 'CX-PRESENTE', nome: 'x', quantidade: 4 }] },
    ]);

    expect(resultado[0]!.clientes.map(({ id }) => id)).toEqual(['y', 'z']);
  });

  it('o nome do produto vem do catálogo; sem ele, do item; sem item, o próprio SKU', () => {
    const resultado = estoqueBaixoPorProduto(['CX-PRESENTE', 'TRUF-70', 'DRAGEE'], new Map([['CX-PRESENTE', 'Caixa presente']]), [
      cliente('a', [{ sku: 'TRUF-70', nome: 'Trufas 70%', quantidade: 1 }]),
    ]);

    expect(Object.fromEntries(resultado.map(({ sku, nome }) => [sku, nome]))).toEqual({
      'CX-PRESENTE': 'Caixa presente',
      'TRUF-70': 'Trufas 70%',
      DRAGEE: 'DRAGEE',
    });
  });
});

describe('clientesComEstoqueBaixo', () => {
  it('conta cada cliente uma vez, mesmo baixo em mais de um produto da data', () => {
    const estoque = estoqueBaixoPorProduto(['CX-PRESENTE', 'BOMB-SORT'], new Map(), [
      cliente('a', [
        { sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 1 },
        { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 2 },
      ]),
      cliente('b', [{ sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 2 }]),
      cliente('c', []),
    ]);

    expect(clientesComEstoqueBaixo(estoque)).toBe(2);
  });
});
