import { Prisma, type ResultadoVisita } from '@prisma/client';
import { somarDias } from '../../src/services/classificacao.service';
import {
  agruparPorRepresentante,
  ritmoNoPeriodo,
  type Janela,
  type VisitaDoPeriodo,
  type VisitaDoRitmo,
} from '../../src/services/kpis.regras';

type VisitaComCarteira = VisitaDoPeriodo & {
  representanteId: string;
  clienteNome: string;
  totalPedido: Prisma.Decimal.Value;
};

function visita(
  representanteId: string,
  resultado: ResultadoVisita,
  clientId = 'c',
  totalPedido: Prisma.Decimal.Value = 0,
  clienteNome = `Loja ${clientId}`,
): VisitaComCarteira {
  return { clientId, resultado, representanteId, clienteNome, totalPedido };
}

/** Meio-dia em -03:00, longe da virada do dia. */
function meioDia(
  dia: string,
  resultado: ResultadoVisita = 'SEM_VENDA',
  clientId = 'c',
  clienteNome = `Loja ${clientId}`,
): VisitaDoRitmo {
  return { clientId, clienteNome, dataHora: new Date(`${dia}T12:00:00.000-03:00`), resultado };
}

/** Janela de `dias` dias terminando em `fim`. */
function janelaAte(fim: string, dias: number): Janela {
  return { dias, inicio: somarDias(fim, -(dias - 1)), fim };
}

describe('agruparPorRepresentante', () => {
  const representantes = [
    { id: 'r-eduarda', nome: 'Eduarda Fischer' },
    { id: 'r-bruno', nome: 'Bruno Alencar' },
  ];

  it('conta clientes ativos, visitas e conversão por carteira; representante sem visita fica com zeros', () => {
    const resultado = agruparPorRepresentante(
      [visita('r-eduarda', 'VENDA'), visita('r-eduarda', 'SEM_VENDA'), visita('r-eduarda', 'VENDA')],
      [{ representanteId: 'r-eduarda' }, { representanteId: 'r-eduarda' }, { representanteId: 'r-bruno' }],
      representantes,
    );

    expect(resultado).toEqual([
      {
        id: 'r-eduarda',
        nome: 'Eduarda Fischer',
        clientesAtivos: 2,
        visitas: 3,
        vendas: 2,
        negociacoes: 0,
        semVenda: 1,
        conversaoEmVendas: { numerador: 2, denominador: 3, percentual: 67 },
        receita: 0,
        clientes: [{ id: 'c', nomeFantasia: 'Loja c', vendas: 2, negociacoes: 0, semVenda: 1 }],
      },
      {
        id: 'r-bruno',
        nome: 'Bruno Alencar',
        clientesAtivos: 1,
        visitas: 0,
        vendas: 0,
        negociacoes: 0,
        semVenda: 0,
        conversaoEmVendas: { numerador: 0, denominador: 0, percentual: null },
        receita: 0,
        clientes: [],
      },
    ]);
  });

  it('as contagens de VENDA, NEGOCIACAO e SEM_VENDA de cada representante batem com as visitas do período', () => {
    const resultado = agruparPorRepresentante(
      [
        ...Array.from({ length: 5 }, () => visita('r-eduarda', 'VENDA')),
        ...Array.from({ length: 4 }, () => visita('r-eduarda', 'NEGOCIACAO')),
        ...Array.from({ length: 3 }, () => visita('r-eduarda', 'SEM_VENDA')),
        visita('r-bruno', 'NEGOCIACAO'),
        visita('r-bruno', 'SEM_VENDA'),
      ],
      [],
      representantes,
    );

    const contagens = resultado.map(({ nome, visitas, vendas, negociacoes, semVenda }) => [
      nome,
      visitas,
      vendas,
      negociacoes,
      semVenda,
    ]);
    expect(contagens).toEqual([
      ['Eduarda Fischer', 12, 5, 4, 3],
      ['Bruno Alencar', 2, 0, 1, 1],
    ]);
    for (const linha of resultado) {
      expect(linha.vendas + linha.negociacoes + linha.semVenda).toBe(linha.visitas);
      expect(linha.conversaoEmVendas.numerador).toBe(linha.vendas);
    }
  });

  it('ordena por visitas (desc) e, no empate, por nome', () => {
    const resultado = agruparPorRepresentante(
      [visita('r-bruno', 'VENDA'), visita('r-carla', 'VENDA'), visita('r-carla', 'NEGOCIACAO')],
      [],
      [
        { id: 'r-eduarda', nome: 'Eduarda Fischer' },
        { id: 'r-bruno', nome: 'Bruno Alencar' },
        { id: 'r-ana', nome: 'Ana Souza' },
        { id: 'r-carla', nome: 'Carla Dias' },
      ],
    );

    expect(resultado.map((r) => [r.nome, r.visitas])).toEqual([
      ['Carla Dias', 2],
      ['Bruno Alencar', 1],
      ['Ana Souza', 0],
      ['Eduarda Fischer', 0],
    ]);
  });

  it('visita de carteira fora da lista de representantes não aparece', () => {
    const resultado = agruparPorRepresentante([visita('r-outro', 'VENDA')], [], representantes);

    expect(resultado.map((r) => r.id)).toEqual(['r-bruno', 'r-eduarda']);
    expect(resultado.every((r) => r.visitas === 0 && r.vendas === 0)).toBe(true);
  });

  it('receita soma só os pedidos das visitas com VENDA, em 2 casas', () => {
    const resultado = agruparPorRepresentante(
      [
        visita('r-eduarda', 'VENDA', 'a', new Prisma.Decimal('12.50')),
        visita('r-eduarda', 'VENDA', 'b', '12.50'),
        visita('r-eduarda', 'VENDA', 'a', '0.10'),
        visita('r-eduarda', 'NEGOCIACAO', 'a', '99.00'),
        visita('r-eduarda', 'SEM_VENDA', 'b', '50.00'),
        visita('r-bruno', 'VENDA', 'c', '7.005'),
      ],
      [],
      representantes,
    );

    expect(resultado.find((r) => r.id === 'r-eduarda')!.receita).toBe(25.1);
    expect(resultado.find((r) => r.id === 'r-bruno')!.receita).toBe(7.01);
  });

  it('clientes com as visitas do período por resultado, do que tem mais visitas ao que tem menos e, no empate, por nome', () => {
    const resultado = agruparPorRepresentante(
      [
        visita('r-eduarda', 'VENDA', 'z', 0, 'Zebra Doces'),
        visita('r-eduarda', 'SEM_VENDA', 'z', 0, 'Zebra Doces'),
        visita('r-eduarda', 'NEGOCIACAO', 'z', 0, 'Zebra Doces'),
        visita('r-eduarda', 'VENDA', 'b', 0, 'Bombons Indaial'),
        visita('r-eduarda', 'VENDA', 'a', 0, 'Armazém São Bento'),
        visita('r-bruno', 'SEM_VENDA', 'x', 0, 'Outra Loja'),
      ],
      [],
      representantes,
    );

    expect(resultado.find((r) => r.id === 'r-eduarda')!.clientes).toEqual([
      { id: 'z', nomeFantasia: 'Zebra Doces', vendas: 1, negociacoes: 1, semVenda: 1 },
      { id: 'a', nomeFantasia: 'Armazém São Bento', vendas: 1, negociacoes: 0, semVenda: 0 },
      { id: 'b', nomeFantasia: 'Bombons Indaial', vendas: 1, negociacoes: 0, semVenda: 0 },
    ]);
    expect(resultado.find((r) => r.id === 'r-bruno')!.clientes).toEqual([
      { id: 'x', nomeFantasia: 'Outra Loja', vendas: 0, negociacoes: 0, semVenda: 1 },
    ]);
  });
});

describe('ritmoNoPeriodo', () => {
  // 2026-10-25 é domingo.
  it('30 dias terminando num domingo: 5 semanas, a primeira parcial, rótulos nas segundas', () => {
    const ritmo = ritmoNoPeriodo([], janelaAte('2026-10-25', 30));

    expect(ritmo.granularidade).toBe('SEMANA');
    expect(ritmo.faixas.map(({ inicio, fim, parcial }) => [inicio, fim, parcial])).toEqual([
      ['2026-09-21', '2026-09-27', true], // a janela começa no sábado, 26/09
      ['2026-09-28', '2026-10-04', false],
      ['2026-10-05', '2026-10-11', false],
      ['2026-10-12', '2026-10-18', false],
      ['2026-10-19', '2026-10-25', false],
    ]);
    expect(ritmo.faixas.every((f) => f.visitas === 0 && f.vendas === 0 && f.clientes.length === 0)).toBe(true);
  });

  it('semana que termina depois do fim da janela também é parcial', () => {
    const ritmo = ritmoNoPeriodo([], janelaAte('2026-10-21', 14)); // 08/10 (qui) a 21/10 (qua)

    expect(ritmo.faixas.map(({ inicio, parcial }) => [inicio, parcial])).toEqual([
      ['2026-10-05', true],
      ['2026-10-12', false],
      ['2026-10-19', true],
    ]);
  });

  it('91 dias → semanas; 92 dias → meses', () => {
    const semanas = ritmoNoPeriodo([], janelaAte('2026-10-25', 91));
    const meses = ritmoNoPeriodo([], janelaAte('2026-10-25', 92));

    expect(semanas.granularidade).toBe('SEMANA');
    expect(semanas.faixas).toHaveLength(13); // 91 dias terminando num domingo: 13 semanas cheias, de segunda a domingo
    expect(semanas.faixas.some((f) => f.parcial)).toBe(false);
    expect(meses.granularidade).toBe('MES');
    // 92 dias começam em 26/07: julho a outubro.
    expect(meses.faixas.map((f) => f.inicio)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('365 dias terminando em 25/10/2026: 13 meses, out/2025 e out/2026 parciais', () => {
    const ritmo = ritmoNoPeriodo([], janelaAte('2026-10-25', 365));

    expect(ritmo.granularidade).toBe('MES');
    expect(ritmo.faixas).toHaveLength(13);
    expect(ritmo.faixas[0]).toMatchObject({ inicio: '2025-10-01', fim: '2025-10-31', parcial: true });
    expect(ritmo.faixas[1]).toMatchObject({ inicio: '2025-11-01', fim: '2025-11-30', parcial: false });
    expect(ritmo.faixas[4]).toMatchObject({ inicio: '2026-02-01', fim: '2026-02-28', parcial: false });
    expect(ritmo.faixas[11]).toMatchObject({ inicio: '2026-09-01', fim: '2026-09-30', parcial: false });
    expect(ritmo.faixas[12]).toMatchObject({ inicio: '2026-10-01', fim: '2026-10-31', parcial: true });
    expect(ritmo.faixas.filter((f) => f.parcial)).toHaveLength(2);
  });

  it('mês que cabe inteiro na janela não é parcial', () => {
    const ritmo = ritmoNoPeriodo([], { dias: 92, inicio: '2026-07-01', fim: '2026-10-01' });

    expect(ritmo.faixas.map((f) => [f.inicio, f.parcial])).toEqual([
      ['2026-07-01', false],
      ['2026-08-01', false],
      ['2026-09-01', false],
      ['2026-10-01', true], // só o dia 1 de outubro
    ]);
  });

  it('um dia só: uma faixa parcial', () => {
    const ritmo = ritmoNoPeriodo([meioDia('2026-10-14', 'VENDA')], janelaAte('2026-10-14', 1));

    expect(ritmo.granularidade).toBe('SEMANA');
    expect(ritmo.faixas).toEqual([
      {
        inicio: '2026-10-12',
        fim: '2026-10-18',
        parcial: true,
        visitas: 1,
        vendas: 1,
        clientes: [{ id: 'c', nomeFantasia: 'Loja c', visitas: 1, vendas: 1 }],
      },
    ]);
  });

  it('visita às 23:30 de domingo cai na semana que termina nesse domingo; visita fora da janela é ignorada', () => {
    const ritmo = ritmoNoPeriodo(
      [
        // Domingo 18/10, 23:30 em São Paulo = segunda 19/10, 02:30 em UTC.
        { clientId: 'c', clienteNome: 'Loja c', dataHora: new Date('2026-10-18T23:30:00.000-03:00'), resultado: 'VENDA' },
        meioDia('2026-09-25', 'VENDA'), // antes da janela, ainda que dentro da semana parcial de 21/09
        meioDia('2026-10-26', 'VENDA'), // depois da janela
      ],
      janelaAte('2026-10-25', 30),
    );

    const porInicio = Object.fromEntries(ritmo.faixas.map((f) => [f.inicio, [f.visitas, f.vendas]]));
    expect(porInicio['2026-10-12']).toEqual([1, 1]);
    expect(porInicio['2026-10-19']).toEqual([0, 0]);
    expect(ritmo.faixas.reduce((soma, f) => soma + f.visitas, 0)).toBe(1);
  });

  it('visitas e vendas por mês na granularidade mensal', () => {
    const ritmo = ritmoNoPeriodo(
      [meioDia('2026-10-02', 'VENDA'), meioDia('2026-10-20', 'SEM_VENDA'), meioDia('2026-03-15', 'NEGOCIACAO')],
      janelaAte('2026-10-25', 365),
    );

    expect(ritmo.faixas.find((f) => f.inicio === '2026-10-01')).toMatchObject({ visitas: 2, vendas: 1 });
    expect(ritmo.faixas.find((f) => f.inicio === '2026-03-01')).toMatchObject({ visitas: 1, vendas: 0 });
  });

  it('clientes da faixa com visitas e vendas, em ordem de visitas desc e nome', () => {
    const ritmo = ritmoNoPeriodo(
      [
        meioDia('2026-10-13', 'VENDA', 'z', 'Zebra Doces'),
        meioDia('2026-10-14', 'SEM_VENDA', 'z', 'Zebra Doces'),
        meioDia('2026-10-15', 'VENDA', 'z', 'Zebra Doces'),
        meioDia('2026-10-13', 'NEGOCIACAO', 'b', 'Bombons Indaial'),
        meioDia('2026-10-16', 'VENDA', 'a', 'Armazém São Bento'),
        meioDia('2026-10-07', 'VENDA', 'a', 'Armazém São Bento'), // outra semana
      ],
      janelaAte('2026-10-25', 30),
    );

    expect(ritmo.faixas.find((f) => f.inicio === '2026-10-12')!.clientes).toEqual([
      { id: 'z', nomeFantasia: 'Zebra Doces', visitas: 3, vendas: 2 },
      { id: 'a', nomeFantasia: 'Armazém São Bento', visitas: 1, vendas: 1 },
      { id: 'b', nomeFantasia: 'Bombons Indaial', visitas: 1, vendas: 0 },
    ]);
    expect(ritmo.faixas.find((f) => f.inicio === '2026-10-05')!.clientes).toEqual([
      { id: 'a', nomeFantasia: 'Armazém São Bento', visitas: 1, vendas: 1 },
    ]);
  });
});
