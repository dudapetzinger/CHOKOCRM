import type { ResultadoVisita } from '@prisma/client';
import {
  agruparPorRepresentante,
  inicioDoRitmoSemanal,
  ritmoSemanal,
  type VisitaDoPeriodo,
} from '../../src/services/kpis.regras';

type VisitaComCarteira = VisitaDoPeriodo & { representanteId: string };

function visita(representanteId: string, resultado: ResultadoVisita, clientId = 'c'): VisitaComCarteira {
  return { clientId, resultado, representanteId };
}

/** Meio-dia em -03:00, longe da virada do dia. */
function meioDia(dia: string, resultado: ResultadoVisita = 'SEM_VENDA'): { dataHora: Date; resultado: ResultadoVisita } {
  return { dataHora: new Date(`${dia}T12:00:00.000-03:00`), resultado };
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
});

describe('ritmoSemanal', () => {
  it('sempre 8 semanas de segunda a domingo, a última contendo hoje (uma quarta), com zeros', () => {
    // 2026-10-14 é quarta: a semana de hoje começa na segunda 12/10; a primeira, sete semanas antes.
    const semanas = ritmoSemanal([], '2026-10-14');

    expect(semanas.map(({ inicio }) => inicio)).toEqual([
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
    expect(semanas.every(({ visitas, vendas }) => visitas === 0 && vendas === 0)).toBe(true);
  });

  it('hoje numa segunda: a última semana começa hoje', () => {
    const semanas = ritmoSemanal([], '2026-10-12');

    expect(semanas).toHaveLength(8);
    expect(semanas[7]!.inicio).toBe('2026-10-12');
    expect(semanas[0]!.inicio).toBe('2026-08-24');
  });

  it('hoje num domingo: a última semana começou seis dias antes', () => {
    const semanas = ritmoSemanal([], '2026-10-18');

    expect(semanas).toHaveLength(8);
    expect(semanas[7]!.inicio).toBe('2026-10-12');
  });

  it('conta as visitas de cada semana e, delas, só as com resultado VENDA em vendas', () => {
    const semanas = ritmoSemanal(
      [
        meioDia('2026-10-12', 'VENDA'),
        meioDia('2026-10-14', 'NEGOCIACAO'),
        meioDia('2026-10-13', 'SEM_VENDA'),
        meioDia('2026-10-05', 'VENDA'),
        meioDia('2026-10-11', 'VENDA'),
        meioDia('2026-08-24', 'NEGOCIACAO'),
      ],
      '2026-10-14',
    );

    expect(semanas[7]).toEqual({ inicio: '2026-10-12', visitas: 3, vendas: 1 });
    expect(semanas[6]).toEqual({ inicio: '2026-10-05', visitas: 2, vendas: 2 });
    expect(semanas[0]).toEqual({ inicio: '2026-08-24', visitas: 1, vendas: 0 });
  });

  it('ignora visitas antes da primeira semana e depois de domingo da semana de hoje', () => {
    const semanas = ritmoSemanal(
      [meioDia('2026-08-23', 'VENDA'), meioDia('2026-10-19', 'VENDA'), meioDia('2026-10-18', 'VENDA')],
      '2026-10-14',
    );

    expect(semanas.reduce((soma, semana) => soma + semana.visitas, 0)).toBe(1);
    expect(semanas[7]).toEqual({ inicio: '2026-10-12', visitas: 1, vendas: 1 });
  });

  it('agrupa pelo dia de calendário em America/Sao_Paulo, não em UTC', () => {
    // 2026-10-12T01:00Z é domingo, 11/10, 22:00 em -03:00 → semana de 05/10.
    const semanas = ritmoSemanal([{ dataHora: new Date('2026-10-12T01:00:00.000Z'), resultado: 'VENDA' }], '2026-10-14');

    expect(semanas[6]).toEqual({ inicio: '2026-10-05', visitas: 1, vendas: 1 });
    expect(semanas[7]).toEqual({ inicio: '2026-10-12', visitas: 0, vendas: 0 });
  });

  it('inicioDoRitmoSemanal é a segunda da primeira das 8 semanas (para buscar as visitas)', () => {
    expect(inicioDoRitmoSemanal('2026-10-14')).toBe('2026-08-24');
    expect(inicioDoRitmoSemanal('2026-10-18')).toBe('2026-08-24');
    expect(inicioDoRitmoSemanal('2026-10-19')).toBe('2026-08-31');
  });
});
