import type { Sale } from '../../src/providers/erp/ErpProvider';
import { DIAS_DE_BASE } from '../../src/config/sazonalidade';
import type { ItemBaixo } from '../../src/services/erp.service';
import {
  acaoPorVariacao,
  calcularVariacao,
  cruzarEstoqueComEventos,
  eventosNoHorizonte,
  janelaDoAnoAnterior,
  montarTextoDaSugestao,
  periodoBase,
  produtosMaisComprados,
  totalNaJanela,
  type ClienteComEstoque,
  type EventoDoBanco,
  type EventoProximo,
} from '../../src/services/insights.regras';

/** `dataFim` entra como 'AAAA-MM-DD' e vira meia-noite UTC, como o Prisma devolve uma coluna `@db.Date`. */
function eventoDoBanco(
  overrides: Omit<Partial<EventoDoBanco>, 'dataFim'> & { id: string; dataFim: string },
): EventoDoBanco {
  const { dataFim, ...resto } = overrides;

  return {
    nome: `Evento ${overrides.id}`,
    chave: 'NATAL',
    produtosSugeridos: ['caixas presente'],
    ...resto,
    dataFim: new Date(`${dataFim}T00:00:00Z`),
  };
}

function eventoProximo(overrides: Partial<EventoProximo> = {}): EventoProximo {
  return {
    id: 'natal-2026',
    nome: 'Natal 2026',
    chave: 'NATAL',
    dataEvento: '2026-12-25',
    diasAteEvento: 79,
    produtosSugeridos: ['caixas presente'],
    ...overrides,
  };
}

function venda(dia: string, valor: number, produtos: Sale['produtos'] = []): Sale {
  return { data: new Date(`${dia}T12:00:00Z`), valor, produtos };
}

describe('eventosNoHorizonte', () => {
  it('inclui evento de hoje (0 dias) e no limite do horizonte; exclui ontem e horizonte + 1; ordena por data', () => {
    const eventos = [
      eventoDoBanco({ id: 'limite', dataFim: '2027-01-05' }),
      eventoDoBanco({ id: 'natal', dataFim: '2026-12-25' }),
      eventoDoBanco({ id: 'alem', dataFim: '2027-01-06' }),
      eventoDoBanco({ id: 'hoje', dataFim: '2026-10-07' }),
      eventoDoBanco({ id: 'ontem', dataFim: '2026-10-06' }),
    ];

    const proximos = eventosNoHorizonte(eventos, '2026-10-07', 90);

    expect(proximos.map((evento) => [evento.id, evento.dataEvento, evento.diasAteEvento])).toEqual([
      ['hoje', '2026-10-07', 0],
      ['natal', '2026-12-25', 79],
      ['limite', '2027-01-05', 90],
    ]);
  });

  it('copia nome, chave e produtos sugeridos do evento do banco', () => {
    const [evento] = eventosNoHorizonte(
      [
        eventoDoBanco({
          id: 'natal',
          nome: 'Natal 2026',
          chave: 'NATAL',
          dataFim: '2026-12-25',
          produtosSugeridos: ['panetones de chocolate', 'caixas presente'],
        }),
      ],
      '2026-10-07',
      90,
    );

    expect(evento).toEqual({
      id: 'natal',
      nome: 'Natal 2026',
      chave: 'NATAL',
      dataEvento: '2026-12-25',
      diasAteEvento: 79,
      produtosSugeridos: ['panetones de chocolate', 'caixas presente'],
    });
  });

  it('inclui evento do ano seguinte dentro do horizonte', () => {
    const proximos = eventosNoHorizonte(
      [
        eventoDoBanco({ id: 'pascoa-2027', chave: 'PASCOA', dataFim: '2027-03-28' }),
        eventoDoBanco({ id: 'natal-2026', chave: 'NATAL', dataFim: '2026-12-25' }),
      ],
      '2026-12-20',
      180,
    );

    expect(proximos.map((evento) => [evento.id, evento.diasAteEvento])).toEqual([
      ['natal-2026', 5],
      ['pascoa-2027', 98],
    ]);
  });
});

describe('janelaDoAnoAnterior / periodoBase', () => {
  it("PASCOA 2026 → ['2025-03-21', '2025-04-20']; NATAL 2026 → ['2025-11-25', '2025-12-25']", () => {
    expect(janelaDoAnoAnterior('PASCOA', 2026)).toEqual({ inicio: '2025-03-21', fim: '2025-04-20' });
    expect(janelaDoAnoAnterior('NATAL', 2026)).toEqual({ inicio: '2025-11-25', fim: '2025-12-25' });
  });

  it("PASCOA 2027 → ['2026-03-06', '2026-04-05'] (não a janela de 2027 deslocada)", () => {
    expect(janelaDoAnoAnterior('PASCOA', 2027)).toEqual({ inicio: '2026-03-06', fim: '2026-04-05' });
  });

  it("periodoBase da janela do Natal 2026 → ['2024-11-25', '2025-11-24']", () => {
    expect(periodoBase(janelaDoAnoAnterior('NATAL', 2026))).toEqual({ inicio: '2024-11-25', fim: '2025-11-24' });
  });
});

describe('totalNaJanela / calcularVariacao / acaoPorVariacao', () => {
  const janela = { inicio: '2025-11-25', fim: '2025-12-25' };

  it('soma só vendas com dataCalendario dentro da janela, limites inclusivos', () => {
    const vendas = [
      venda('2025-11-24', 1000),
      venda('2025-11-25', 100),
      venda('2025-12-10', 10),
      venda('2025-12-25', 1),
      venda('2025-12-26', 5000),
    ];

    expect(totalNaJanela(vendas, janela)).toBe(111);
  });

  it('usa o dia de calendário no fuso do negócio, não o dia UTC', () => {
    // 02:00Z de 26/12 ainda é 25/12 às 23:00 em America/Sao_Paulo (-03:00).
    const tardeNoUltimoDia: Sale = { data: new Date('2025-12-26T02:00:00Z'), valor: 7, produtos: [] };

    expect(totalNaJanela([tardeNoUltimoDia], janela)).toBe(7);
  });

  it('variação: janela 31 dias, base 3650 → média 310; total 573,5 → 0.85; 217 → -0.3', () => {
    expect(DIAS_DE_BASE).toBe(365);
    expect(calcularVariacao(573.5, 3650, 31)).toBeCloseTo(0.85, 10);
    expect(calcularVariacao(217, 3650, 31)).toBeCloseTo(-0.3, 10);
    expect(calcularVariacao(310, 3650, 31)).toBeCloseTo(0, 10);
  });

  it('null sem base ou sem compra na janela', () => {
    expect(calcularVariacao(500, 0, 31)).toBeNull();
    expect(calcularVariacao(0, 3650, 31)).toBeNull();
    expect(calcularVariacao(0, 0, 31)).toBeNull();
  });

  it('limiares: 0.2 → AUMENTAR_OFERTA; 0.19 → CRIAR_PROMOCAO; -0.19 → CRIAR_PROMOCAO; -0.2 → OFERTAR_DESCONTO', () => {
    expect(acaoPorVariacao(0.2)).toBe('AUMENTAR_OFERTA');
    expect(acaoPorVariacao(0.19)).toBe('CRIAR_PROMOCAO');
    expect(acaoPorVariacao(0)).toBe('CRIAR_PROMOCAO');
    expect(acaoPorVariacao(-0.19)).toBe('CRIAR_PROMOCAO');
    expect(acaoPorVariacao(-0.2)).toBe('OFERTAR_DESCONTO');
  });

  it('arredondamento: Math.round(0.195 * 100) / 100 → AUMENTAR_OFERTA', () => {
    expect(acaoPorVariacao(Math.round(0.195 * 100) / 100)).toBe('AUMENTAR_OFERTA');
  });
});

describe('produtosMaisComprados', () => {
  it('soma quantidade por SKU, devolve os 3 maiores em ordem decrescente, empate pelo nome', () => {
    const vendas = [
      venda('2025-12-01', 100, [
        { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 4 },
        { sku: 'TRUF-70', nome: 'Trufas 70% cacau', quantidade: 6 },
        { sku: 'PAO-MEL', nome: 'Pães de mel', quantidade: 3 },
      ]),
      venda('2025-12-10', 100, [
        { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 7 },
        { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 3 },
        { sku: 'TRUF-70', nome: 'Trufas 70% cacau', quantidade: 4 },
        { sku: 'DRAGEE', nome: 'Dragées de chocolate', quantidade: 1 },
      ]),
    ];

    expect(produtosMaisComprados(vendas, 3)).toEqual([
      { sku: 'TRUF-70', nome: 'Trufas 70% cacau', quantidade: 10 },
      { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 7 },
      { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 7 },
    ]);
  });

  it('devolve lista vazia sem vendas e menos que o máximo quando há poucos produtos', () => {
    expect(produtosMaisComprados([], 3)).toEqual([]);
    expect(
      produtosMaisComprados([venda('2025-12-01', 10, [{ sku: 'TRUF-70', nome: 'Trufas 70% cacau', quantidade: 2 }])], 3),
    ).toEqual([{ sku: 'TRUF-70', nome: 'Trufas 70% cacau', quantidade: 2 }]);
  });
});

describe('montarTextoDaSugestao', () => {
  const produtos = [{ nome: 'Trufas 70% cacau' }, { nome: 'Caixa presente sortida' }, { nome: 'Bombons sortidos' }];
  const listaDeProdutos = 'Trufas 70% cacau, Caixa presente sortida e Bombons sortidos';

  it('AUMENTAR_OFERTA: "Natal em 79 dias" / "Comprou 85% a mais no mesmo período do ano passado. Aumentar a oferta de …"', () => {
    expect(montarTextoDaSugestao(eventoProximo(), 'AUMENTAR_OFERTA', 85, produtos)).toEqual({
      titulo: 'Natal em 79 dias',
      texto: `Comprou 85% a mais no mesmo período do ano passado. Aumentar a oferta de ${listaDeProdutos}.`,
    });
  });

  it('CRIAR_PROMOCAO com +5%: "As compras no mesmo período do ano passado ficaram na média (+5%). Criar promoção sazonal para puxar o volume de …"', () => {
    expect(montarTextoDaSugestao(eventoProximo(), 'CRIAR_PROMOCAO', 5, produtos).texto).toBe(
      `As compras no mesmo período do ano passado ficaram na média (+5%). Criar promoção sazonal para puxar o volume de ${listaDeProdutos}.`,
    );
  });

  it('CRIAR_PROMOCAO com -12%: sinal negativo explícito', () => {
    expect(montarTextoDaSugestao(eventoProximo(), 'CRIAR_PROMOCAO', -12, produtos).texto).toContain('na média (-12%).');
  });

  it('OFERTAR_DESCONTO com -30%: "Comprou 30% a menos no mesmo período do ano passado. Ofertar desconto para recuperar o volume de …"', () => {
    expect(montarTextoDaSugestao(eventoProximo(), 'OFERTAR_DESCONTO', -30, produtos).texto).toBe(
      `Comprou 30% a menos no mesmo período do ano passado. Ofertar desconto para recuperar o volume de ${listaDeProdutos}.`,
    );
  });

  it('0 dias → "Natal é hoje"; 1 dia → "Natal é amanhã"; 0% → "(0%)"; sem produtos → omite "de …" e termina em ponto', () => {
    expect(montarTextoDaSugestao(eventoProximo({ diasAteEvento: 0 }), 'AUMENTAR_OFERTA', 85, produtos).titulo).toBe(
      'Natal é hoje',
    );
    expect(montarTextoDaSugestao(eventoProximo({ diasAteEvento: 1 }), 'AUMENTAR_OFERTA', 85, produtos).titulo).toBe(
      'Natal é amanhã',
    );
    expect(montarTextoDaSugestao(eventoProximo(), 'CRIAR_PROMOCAO', 0, produtos).texto).toContain('na média (0%).');
    expect(montarTextoDaSugestao(eventoProximo(), 'CRIAR_PROMOCAO', -0, produtos).texto).toContain('na média (0%).');

    expect(montarTextoDaSugestao(eventoProximo(), 'AUMENTAR_OFERTA', 85, []).texto).toBe(
      'Comprou 85% a mais no mesmo período do ano passado. Aumentar a oferta.',
    );
    expect(montarTextoDaSugestao(eventoProximo(), 'CRIAR_PROMOCAO', 5, []).texto).toBe(
      'As compras no mesmo período do ano passado ficaram na média (+5%). Criar promoção sazonal para puxar o volume.',
    );
    expect(montarTextoDaSugestao(eventoProximo(), 'OFERTAR_DESCONTO', -30, []).texto).toBe(
      'Comprou 30% a menos no mesmo período do ano passado. Ofertar desconto para recuperar o volume.',
    );
  });

  it('usa o nome do evento sem o ano, a partir da chave', () => {
    const pascoa = eventoProximo({ nome: 'Páscoa 2027', chave: 'PASCOA', diasAteEvento: 40 });

    expect(montarTextoDaSugestao(pascoa, 'AUMENTAR_OFERTA', 50, produtos).titulo).toBe('Páscoa em 40 dias');
  });
});

describe('cruzarEstoqueComEventos', () => {
  const atualizadoEm = new Date('2026-10-06T03:00:00.000Z');

  function item(sku: string, nome: string, quantidade: number): ItemBaixo {
    return { sku, nome, quantidade, atualizadoEm };
  }

  const cx = (quantidade: number) => item('CX-PRESENTE', 'Caixa presente sortida', quantidade);
  const bomb = (quantidade: number) => item('BOMB-SORT', 'Bombons sortidos', quantidade);
  const paoDeMel = (quantidade: number) => item('PAO-MEL', 'Pães de mel', quantidade);

  function cliente(id: string, itensBaixos: ItemBaixo[]): ClienteComEstoque {
    return { id, nomeFantasia: `Loja ${id}`, cidade: 'Pomerode', itensBaixos };
  }

  it('agrupa por evento × produto só os SKUs de SKUS_SUGERIDOS[chave]; PAO-MEL antes do Natal não gera alerta; cliente sem item baixo não aparece', () => {
    const natal = eventoProximo();
    const clientes = [
      cliente('a', [cx(4), paoDeMel(2)]),
      cliente('b', [cx(2), bomb(5)]),
      cliente('c', []),
    ];

    const alertas = cruzarEstoqueComEventos(clientes, [natal]);

    expect(alertas).toEqual([
      {
        evento: { id: 'natal-2026', nome: 'Natal 2026', dataEvento: '2026-12-25', diasAteEvento: 79 },
        produto: { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida' },
        clientes: [
          { id: 'b', nomeFantasia: 'Loja b', cidade: 'Pomerode', quantidade: 2, atualizadoEm: '2026-10-06T03:00:00.000Z' },
          { id: 'a', nomeFantasia: 'Loja a', cidade: 'Pomerode', quantidade: 4, atualizadoEm: '2026-10-06T03:00:00.000Z' },
        ],
      },
      {
        evento: { id: 'natal-2026', nome: 'Natal 2026', dataEvento: '2026-12-25', diasAteEvento: 79 },
        produto: { sku: 'BOMB-SORT', nome: 'Bombons sortidos' },
        clientes: [
          { id: 'b', nomeFantasia: 'Loja b', cidade: 'Pomerode', quantidade: 5, atualizadoEm: '2026-10-06T03:00:00.000Z' },
        ],
      },
    ]);
    expect(alertas.flatMap((alerta) => alerta.clientes.map((c) => c.id))).not.toContain('c');
    expect(alertas.map((alerta) => alerta.produto.sku)).not.toContain('PAO-MEL');
  });

  it('ordena por diasAteEvento, depois mais clientes primeiro, depois nome do produto; clientes por quantidade crescente; atualizadoEm em ISO', () => {
    const natal = eventoProximo();
    const namorados = eventoProximo({
      id: 'namorados',
      nome: 'Dia dos Namorados 2026',
      chave: 'NAMORADOS',
      dataEvento: '2026-10-17',
      diasAteEvento: 10,
    });
    const clientes = [
      cliente('a', [cx(9), bomb(8)]),
      cliente('b', [cx(1), bomb(3)]),
      cliente('c', [cx(5)]),
    ];

    const alertas = cruzarEstoqueComEventos(clientes, [natal, namorados]);

    expect(alertas.map((alerta) => [alerta.evento.id, alerta.produto.sku, alerta.clientes.map((c) => c.id)])).toEqual([
      ['namorados', 'CX-PRESENTE', ['b', 'c', 'a']],
      ['namorados', 'BOMB-SORT', ['b', 'a']],
      ['natal-2026', 'CX-PRESENTE', ['b', 'c', 'a']],
      ['natal-2026', 'BOMB-SORT', ['b', 'a']],
    ]);
    expect(alertas[0]!.clientes.map((c) => c.quantidade)).toEqual([1, 5, 9]);
    expect(alertas[0]!.clientes[0]!.atualizadoEm).toBe(atualizadoEm.toISOString());
  });

  it('desempata pelo nome do produto quando eventos e número de clientes são iguais', () => {
    const clientes = [cliente('a', [cx(4), bomb(2)])];

    const alertas = cruzarEstoqueComEventos(clientes, [eventoProximo()]);

    expect(alertas.map((alerta) => alerta.produto.nome)).toEqual(['Bombons sortidos', 'Caixa presente sortida']);
  });

  it('devolve lista vazia sem eventos ou sem clientes com item baixo', () => {
    expect(cruzarEstoqueComEventos([cliente('a', [cx(4)])], [])).toEqual([]);
    expect(cruzarEstoqueComEventos([cliente('a', [])], [eventoProximo()])).toEqual([]);
  });
});
