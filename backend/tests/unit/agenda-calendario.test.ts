import type { ClienteParaAgenda } from '../../src/repositories/client.repository';
import { limitesDoMes, montarCalendario, type ItemCalendario } from '../../src/services/agenda.calendario';
import type { LembreteParaAgenda } from '../../src/services/agenda.montagem';
import { somarDias } from '../../src/services/classificacao.service';

/** 19/10/2026, meio-dia em São Paulo. */
const hoje = new Date('2026-10-19T15:00:00Z');

function diasAtras(n: number): Date {
  return new Date(`${somarDias('2026-10-19', -n)}T15:00:00Z`);
}

function colunaDate(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

function clienteFabricado(overrides: Partial<ClienteParaAgenda> & { id: string }): ClienteParaAgenda {
  return {
    nomeFantasia: `Cliente ${overrides.id}`,
    cidade: 'Pomerode',
    endereco: 'Rua XV de Novembro, 100',
    criadoEm: diasAtras(200),
    recorrenciaDias: 15,
    erpId: null,
    visits: [],
    representante: { id: 'rep-1', nome: 'Eduarda Fischer' },
    proximaVisita: null,
    proximaCampanha: null,
    ...overrides,
  };
}

function lembreteFabricado(id: string, data: string, nomeFantasia = `Cliente ${id}`): LembreteParaAgenda {
  return {
    id,
    texto: 'Levar amostras de Natal',
    data: colunaDate(data),
    client: {
      id: `cli-${id}`,
      nomeFantasia,
      cidade: 'Pomerode',
      representante: { id: 'rep-1', nome: 'Eduarda Fischer' },
    },
  };
}

type Entrada = Parameters<typeof montarCalendario>[0];

function calendario(parcial: Partial<Entrada>) {
  return montarCalendario({
    clientes: [],
    lembretes: [],
    campanhas: null,
    eventos: [],
    mes: '2026-10',
    hoje,
    ultimasVendas: new Map(),
    ...parcial,
  });
}

function doTipo(itens: ItemCalendario[], tipo: ItemCalendario['tipo']): ItemCalendario[] {
  return itens.filter((item) => item.tipo === tipo);
}

describe('limitesDoMes', () => {
  it('devolve o primeiro e o último dia do mês, inclusive em fevereiro e dezembro', () => {
    expect(limitesDoMes('2026-10')).toEqual({ primeiro: '2026-10-01', ultimo: '2026-10-31' });
    expect(limitesDoMes('2028-02')).toEqual({ primeiro: '2028-02-01', ultimo: '2028-02-29' });
    expect(limitesDoMes('2026-12')).toEqual({ primeiro: '2026-12-01', ultimo: '2026-12-31' });
  });
});

describe('montarCalendario', () => {
  it('visita marcada no check-in aparece no dia marcado, com a campanha da próxima visita', () => {
    const cliente = clienteFabricado({
      id: 'marcada',
      nomeFantasia: 'Empório Central',
      visits: [{ dataHora: diasAtras(3), resultado: 'VENDA' }],
      proximaVisita: '2026-10-27',
      proximaCampanha: { id: 'cp1', nome: 'Natal Chokolaten' },
    });

    const { mes, itens } = calendario({ clientes: [cliente] });

    expect(mes).toBe('2026-10');
    expect(itens).toEqual([
      {
        data: '2026-10-27',
        tipo: 'VISITA',
        titulo: 'Empório Central',
        clienteId: 'marcada',
        representante: { id: 'rep-1', nome: 'Eduarda Fischer' },
        campanha: { id: 'cp1', nome: 'Natal Chokolaten' },
      },
    ]);
  });

  it('cliente sem data marcada não entra: a recorrência não vai para o calendário', () => {
    const emDia = clienteFabricado({
      id: 'recorrencia',
      recorrenciaDias: 21,
      visits: [{ dataHora: diasAtras(10), resultado: 'VENDA' }],
    });
    const vencido = clienteFabricado({ id: 'vencido', visits: [{ dataHora: diasAtras(20), resultado: 'VENDA' }] });
    const nuncaVisitado = clienteFabricado({ id: 'nunca' });

    expect(calendario({ clientes: [emDia, vencido, nuncaVisitado] }).itens).toEqual([]);
  });

  it('visita marcada que já venceu fica no dia marcado, dizendo há quantos dias venceu', () => {
    const cliente = clienteFabricado({ id: 'vencida', proximaVisita: '2026-10-14' });

    const [item] = calendario({ clientes: [cliente] }).itens;

    expect(item).toMatchObject({ data: '2026-10-14', tipo: 'VISITA', clienteId: 'vencida' });
    expect(item?.detalhe).toBe('Visita marcada venceu há 5 dias');
  });

  it('visita marcada que venceu ontem diz "1 dia"; a de hoje e a futura não trazem detalhe', () => {
    const ontem = clienteFabricado({ id: 'ontem', proximaVisita: '2026-10-18' });
    const deHoje = clienteFabricado({ id: 'hoje', proximaVisita: '2026-10-19' });
    const amanha = clienteFabricado({ id: 'amanha', proximaVisita: '2026-10-20' });

    const itens = calendario({ clientes: [ontem, deHoje, amanha] }).itens;

    expect(itens.map((item) => [item.clienteId, item.detalhe])).toEqual([
      ['ontem', 'Visita marcada venceu há 1 dia'],
      ['hoje', undefined],
      ['amanha', undefined],
    ]);
  });

  it('visita marcada de outro mês fica de fora, vencida ou não', () => {
    const setembro = clienteFabricado({ id: 'setembro', proximaVisita: '2026-09-28' });
    const novembro = clienteFabricado({ id: 'novembro', proximaVisita: '2026-11-03' });

    expect(calendario({ clientes: [setembro, novembro], mes: '2026-09' }).itens.map((i) => i.clienteId)).toEqual([
      'setembro',
    ]);
    expect(calendario({ clientes: [setembro, novembro], mes: '2026-11' }).itens.map((i) => i.clienteId)).toEqual([
      'novembro',
    ]);
    expect(calendario({ clientes: [setembro, novembro] }).itens).toEqual([]);
  });

  it('lembrete aparece no dia dele, com o cliente, o dono da carteira e o texto', () => {
    const { itens } = calendario({ lembretes: [lembreteFabricado('l1', '2026-10-22')] });

    expect(itens).toEqual([
      {
        data: '2026-10-22',
        tipo: 'LEMBRETE',
        titulo: 'Cliente l1',
        clienteId: 'cli-l1',
        lembreteId: 'l1',
        texto: 'Levar amostras de Natal',
        representante: { id: 'rep-1', nome: 'Eduarda Fischer' },
      },
    ]);
  });

  it('lembrete vencido fica no dia dele, dizendo há quantos dias venceu; o de ontem diz "1 dia"', () => {
    const lembretes = [
      lembreteFabricado('velho', '2026-10-14'),
      lembreteFabricado('ontem', '2026-10-18'),
      lembreteFabricado('hoje', '2026-10-19'),
    ];

    const itens = calendario({ lembretes }).itens;

    expect(itens.map((item) => [item.lembreteId, item.data, item.detalhe])).toEqual([
      ['velho', '2026-10-14', 'Lembrete venceu há 5 dias'],
      ['ontem', '2026-10-18', 'Lembrete venceu há 1 dia'],
      ['hoje', '2026-10-19', undefined],
    ]);
  });

  it('lembrete de outro mês fica de fora', () => {
    const lembretes = [lembreteFabricado('setembro', '2026-09-30'), lembreteFabricado('out', '2026-10-01')];

    expect(calendario({ lembretes }).itens.map((item) => item.lembreteId)).toEqual(['out']);
  });

  it('campanha aparece em cada dia do intervalo que cai no mês', () => {
    const campanha = {
      id: 'cp1',
      nome: 'Páscoa antecipada',
      tipo: 'PROMOCAO' as const,
      inicio: colunaDate('2026-09-29'),
      fim: colunaDate('2026-10-02'),
    };

    const itens = doTipo(calendario({ campanhas: [campanha] }).itens, 'CAMPANHA');

    expect(itens.map((item) => item.data)).toEqual(['2026-10-01', '2026-10-02']);
    expect(itens[0]).toEqual({
      data: '2026-10-01',
      tipo: 'CAMPANHA',
      titulo: 'Páscoa antecipada',
      campanha: { id: 'cp1', nome: 'Páscoa antecipada' },
      detalhe: 'Promoção · 29/09/2026 a 02/10/2026',
    });
  });

  it('com campanhas null (representante), nenhum item CAMPANHA', () => {
    const eventos = [{ nome: 'Dia das Crianças', dataFim: colunaDate('2026-10-12') }];
    const itens = calendario({ campanhas: null, eventos }).itens;

    expect(doTipo(itens, 'CAMPANHA')).toEqual([]);
    expect(itens).toHaveLength(1);
  });

  it('data sazonal aparece no dia do dataFim; eventos de outro mês ficam de fora', () => {
    const itens = calendario({
      eventos: [
        { nome: 'Dia das Crianças', dataFim: colunaDate('2026-10-12') },
        { nome: 'Natal', dataFim: colunaDate('2026-12-25') },
      ],
    }).itens;

    expect(itens).toEqual([
      { data: '2026-10-12', tipo: 'DATA_SAZONAL', titulo: 'Dia das Crianças', detalhe: 'Data sazonal' },
    ]);
  });

  it('ordena por dia; no mesmo dia, data sazonal, campanha, visitas (da cor mais urgente ao nome) e lembretes (por nome)', () => {
    const verde = clienteFabricado({
      id: 'verde',
      nomeFantasia: 'Alfa',
      proximaVisita: '2026-10-26',
      visits: [{ dataHora: diasAtras(2), resultado: 'VENDA' }],
    });
    const vermelho = clienteFabricado({ id: 'vermelho', nomeFantasia: 'Zeta', proximaVisita: '2026-10-26' });
    const outroDia = clienteFabricado({ id: 'outro', nomeFantasia: 'Beta', proximaVisita: '2026-10-22' });
    const campanha = {
      id: 'cp1',
      nome: 'Outubro doce',
      tipo: 'CAMPANHA' as const,
      inicio: colunaDate('2026-10-26'),
      fim: colunaDate('2026-10-26'),
    };

    const itens = calendario({
      clientes: [verde, vermelho, outroDia],
      lembretes: [lembreteFabricado('lz', '2026-10-26', 'Zulu'), lembreteFabricado('la', '2026-10-26', 'Abacaxi')],
      campanhas: [campanha],
      eventos: [{ nome: 'Dia do Chocolate', dataFim: colunaDate('2026-10-26') }],
    }).itens;

    expect(itens.map((item) => [item.data, item.titulo])).toEqual([
      ['2026-10-22', 'Beta'],
      ['2026-10-26', 'Dia do Chocolate'],
      ['2026-10-26', 'Outubro doce'],
      ['2026-10-26', 'Zeta'],
      ['2026-10-26', 'Alfa'],
      ['2026-10-26', 'Abacaxi'],
      ['2026-10-26', 'Zulu'],
    ]);
  });
});
