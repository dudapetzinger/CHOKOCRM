import type { ResultadoVisita } from '@prisma/client';
import { agruparPorRepresentante, visitasPorSemana, type VisitaDoPeriodo } from '../../src/services/kpis.regras';

type VisitaComCarteira = VisitaDoPeriodo & { representanteId: string };

function visita(representanteId: string, resultado: ResultadoVisita, clientId = 'c'): VisitaComCarteira {
  return { clientId, resultado, representanteId };
}

/** Meio-dia em -03:00, longe da virada do dia. */
function meioDia(dia: string): { dataHora: Date } {
  return { dataHora: new Date(`${dia}T12:00:00.000-03:00`) };
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
        conversaoEmVendas: { numerador: 2, denominador: 3, percentual: 67 },
      },
      {
        id: 'r-bruno',
        nome: 'Bruno Alencar',
        clientesAtivos: 1,
        visitas: 0,
        conversaoEmVendas: { numerador: 0, denominador: 0, percentual: null },
      },
    ]);
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
    expect(resultado.every((r) => r.visitas === 0)).toBe(true);
  });
});

describe('visitasPorSemana', () => {
  it('30 dias de segunda (2026-09-14) a terça (2026-10-13) geram 5 semanas, com zeros', () => {
    const semanas = visitasPorSemana(
      [meioDia('2026-09-14'), meioDia('2026-09-20'), meioDia('2026-10-05'), meioDia('2026-10-13')],
      '2026-09-14',
      '2026-10-13',
    );

    expect(semanas).toEqual([
      { inicio: '2026-09-14', visitas: 2 },
      { inicio: '2026-09-21', visitas: 0 },
      { inicio: '2026-09-28', visitas: 0 },
      { inicio: '2026-10-05', visitas: 1 },
      { inicio: '2026-10-12', visitas: 1 },
    ]);
  });

  it('início no meio da semana: a primeira semana começa na segunda anterior', () => {
    const semanas = visitasPorSemana([meioDia('2026-09-16')], '2026-09-16', '2026-09-29');

    expect(semanas).toEqual([
      { inicio: '2026-09-14', visitas: 1 },
      { inicio: '2026-09-21', visitas: 0 },
      { inicio: '2026-09-28', visitas: 0 },
    ]);
  });

  it('início num domingo: a primeira semana começa na segunda seis dias antes', () => {
    expect(visitasPorSemana([], '2026-09-20', '2026-09-21')).toEqual([
      { inicio: '2026-09-14', visitas: 0 },
      { inicio: '2026-09-21', visitas: 0 },
    ]);
  });

  it('agrupa pelo dia de calendário em America/Sao_Paulo, não em UTC', () => {
    // 2026-09-21T01:00Z é domingo, 20/09, 22:00 em -03:00 → semana de 14/09.
    const semanas = visitasPorSemana(
      [{ dataHora: new Date('2026-09-21T01:00:00.000Z') }],
      '2026-09-14',
      '2026-09-27',
    );

    expect(semanas).toEqual([
      { inicio: '2026-09-14', visitas: 1 },
      { inicio: '2026-09-21', visitas: 0 },
    ]);
  });
});
