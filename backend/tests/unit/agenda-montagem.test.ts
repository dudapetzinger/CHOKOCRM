import type { ClienteParaAgenda } from '../../src/repositories/client.repository';
import { montarAgenda } from '../../src/services/agenda.montagem';
import { somarDias } from '../../src/services/classificacao.service';

const hoje = new Date('2026-09-27T15:00:00Z');

function diasAtras(n: number, hora = '12:00:00'): Date {
  return new Date(`${somarDias('2026-09-27', -n)}T${hora}Z`);
}

function clienteFabricado(overrides: Partial<ClienteParaAgenda> & { id: string }): ClienteParaAgenda {
  return {
    nomeFantasia: 'Cliente Teste',
    cidade: 'Pomerode',
    criadoEm: diasAtras(100),
    recorrenciaDias: 15,
    erpId: null,
    visits: [],
    representante: { id: 'rep-1', nome: 'Representante' },
    proximaVisita: null,
    endereco: 'Rua XV de Novembro, 100',
    proximaCampanha: null,
    ...overrides,
  };
}

describe('montarAgenda', () => {
  it('separa atrasadas, hoje e futuras', () => {
    const atrasado = clienteFabricado({
      id: 'atrasado',
      recorrenciaDias: 15,
      visits: [{ dataHora: diasAtras(20), resultado: 'VENDA' }],
    });
    const doDia = clienteFabricado({
      id: 'hoje',
      recorrenciaDias: 15,
      visits: [{ dataHora: diasAtras(15), resultado: 'VENDA' }],
    });
    const futuro = clienteFabricado({
      id: 'futuro',
      recorrenciaDias: 15,
      visits: [{ dataHora: diasAtras(10), resultado: 'VENDA' }],
    });

    const agenda = montarAgenda([atrasado, doDia, futuro], hoje);

    expect(agenda.atrasadas).toHaveLength(1);
    expect(agenda.atrasadas[0]?.id).toBe('atrasado');
    expect(agenda.atrasadas[0]?.diasAtraso).toBe(5);

    expect(agenda.hoje).toHaveLength(1);
    expect(agenda.hoje[0]?.id).toBe('hoje');
    expect(agenda.hoje[0]?.diasAtraso).toBe(0);

    // A recorrência vence em 5 dias: entra nos próximos 7 dias, com o atraso negativo
    expect(agenda.proximos7Dias.map((item) => [item.id, item.diasAtraso])).toEqual([['futuro', -5]]);
  });

  it('sem visita usa criadoEm: criado há 20 dias com rec 15 está 5 dias atrasado', () => {
    const semVisita = clienteFabricado({
      id: 'sem-visita',
      recorrenciaDias: 15,
      criadoEm: diasAtras(20),
      visits: [],
    });

    const agenda = montarAgenda([semVisita], hoje);

    expect(agenda.atrasadas).toHaveLength(1);
    const item = agenda.atrasadas[0];
    expect(item?.id).toBe('sem-visita');
    expect(item?.diasAtraso).toBe(5);
    expect(item?.cor).toBe('VERMELHO');
    expect(item?.diasSemVisita).toBeNull();
    expect(item?.proximaVisita).toBe(somarDias('2026-09-27', -5));
  });

  it('ordena por cor, depois por mais atraso, depois por nome', () => {
    const larancia = clienteFabricado({
      id: 'larancia',
      nomeFantasia: 'Larancia Distribuidora',
      recorrenciaDias: 1,
      visits: [{ dataHora: diasAtras(21), resultado: 'SEM_VENDA' }],
    });
    const zulu = clienteFabricado({
      id: 'zulu',
      nomeFantasia: 'Zulu Comércio',
      recorrenciaDias: 1,
      visits: [{ dataHora: diasAtras(41), resultado: 'SEM_VENDA' }],
    });
    const alfa = clienteFabricado({
      id: 'alfa',
      nomeFantasia: 'Alfa Distribuidora',
      recorrenciaDias: 1,
      visits: [{ dataHora: diasAtras(41), resultado: 'SEM_VENDA' }],
    });
    const meio = clienteFabricado({
      id: 'meio',
      nomeFantasia: 'Meio Atacado',
      recorrenciaDias: 1,
      visits: [{ dataHora: diasAtras(61), resultado: 'SEM_VENDA' }],
    });

    const agenda = montarAgenda([zulu, larancia, meio, alfa], hoje);

    expect(agenda.atrasadas.map((item) => ({ id: item.id, cor: item.cor, diasAtraso: item.diasAtraso }))).toEqual([
      { id: 'meio', cor: 'VERMELHO', diasAtraso: 60 },
      { id: 'alfa', cor: 'VERMELHO', diasAtraso: 40 },
      { id: 'zulu', cor: 'VERMELHO', diasAtraso: 40 },
      { id: 'larancia', cor: 'LARANJA', diasAtraso: 20 },
    ]);
  });

  it('repassa o representante dono da carteira para o item', () => {
    const doDia = clienteFabricado({
      id: 'hoje',
      representante: { id: 'rep-b', nome: 'Bruno Alencar' },
      visits: [{ dataHora: diasAtras(15), resultado: 'VENDA' }],
    });

    const agenda = montarAgenda([doDia], hoje);

    expect(agenda.hoje[0]?.representante).toEqual({ id: 'rep-b', nome: 'Bruno Alencar' });
  });

  it('montarAgenda aplica o rebaixamento pelo mapa de últimas vendas', () => {
    const doDia = clienteFabricado({
      id: 'rebaixado',
      erpId: 'ERP-9001',
      recorrenciaDias: 3,
      visits: [{ dataHora: diasAtras(3), resultado: 'VENDA' }],
    });

    const ultimasVendas = new Map([['ERP-9001', diasAtras(90)]]);

    const agenda = montarAgenda([doDia], hoje, ultimasVendas);

    expect(agenda.hoje).toHaveLength(1);
    const item = agenda.hoje[0];
    expect(item?.id).toBe('rebaixado');
    expect(item?.cor).toBe('LARANJA');
    expect(item?.rebaixadoPorVenda).toBe(true);
  });
});

describe('montarAgenda com a próxima visita marcada no check-in (spec 7.4)', () => {
  /** 2026-09-27 é o `hoje` dos testes; `diasDepois(1)` é amanhã. */
  function diasDepois(n: number): string {
    return somarDias('2026-09-27', n);
  }

  function todasAsListas(agenda: ReturnType<typeof montarAgenda>) {
    return [...agenda.atrasadas, ...agenda.hoje, ...agenda.proximos7Dias];
  }

  it('a data marcada no futuro ganha da recorrência: 40 dias sem visita e marcada para amanhã fica nos próximos 7 dias', () => {
    const cliente = clienteFabricado({
      id: 'marcado',
      recorrenciaDias: 15,
      visits: [{ dataHora: diasAtras(40), resultado: 'VENDA' }],
      proximaVisita: diasDepois(1),
    });

    const agenda = montarAgenda([cliente], hoje);

    expect(agenda.atrasadas).toEqual([]);
    expect(agenda.hoje).toEqual([]);
    expect(agenda.proximos7Dias).toHaveLength(1);
    expect(agenda.proximos7Dias[0]).toMatchObject({
      id: 'marcado',
      proximaVisita: diasDepois(1),
      diasAtraso: -1,
      marcadaNoCheckIn: true,
      // A cor continua pela última visita (40 dias sem visita)
      cor: 'VERMELHO',
      diasSemVisita: 40,
    });
  });

  it('marcada para ontem vai para atrasadas com diasAtraso 1, mesmo com a recorrência em dia', () => {
    const cliente = clienteFabricado({
      id: 'marcado-ontem',
      recorrenciaDias: 15,
      visits: [{ dataHora: diasAtras(3), resultado: 'VENDA' }],
      proximaVisita: diasDepois(-1),
    });

    const agenda = montarAgenda([cliente], hoje);

    expect(agenda.atrasadas).toHaveLength(1);
    expect(agenda.atrasadas[0]).toMatchObject({
      id: 'marcado-ontem',
      diasAtraso: 1,
      proximaVisita: diasDepois(-1),
      marcadaNoCheckIn: true,
      cor: 'VERDE',
    });
    expect(agenda.proximos7Dias).toEqual([]);
  });

  it('marcada para hoje vai para hoje', () => {
    const cliente = clienteFabricado({
      id: 'marcado-hoje',
      visits: [{ dataHora: diasAtras(2), resultado: 'NEGOCIACAO' }],
      proximaVisita: diasDepois(0),
    });

    const agenda = montarAgenda([cliente], hoje);

    expect(agenda.hoje.map((item) => [item.id, item.diasAtraso, item.marcadaNoCheckIn])).toEqual([
      ['marcado-hoje', 0, true],
    ]);
  });

  it('daqui a 7 dias ainda entra; daqui a 8 dias fica fora das três listas', () => {
    const seteDias = clienteFabricado({ id: 'sete', proximaVisita: diasDepois(7) });
    const oitoDias = clienteFabricado({
      id: 'oito',
      recorrenciaDias: 15,
      // Pela recorrência estaria atrasado; a data marcada adia para daqui a 8 dias
      visits: [{ dataHora: diasAtras(40), resultado: 'VENDA' }],
      proximaVisita: diasDepois(8),
    });

    const agenda = montarAgenda([seteDias, oitoDias], hoje);

    expect(agenda.proximos7Dias.map((item) => [item.id, item.diasAtraso])).toEqual([['sete', -7]]);
    expect(todasAsListas(agenda).map((item) => item.id)).not.toContain('oito');
  });

  it('sem data marcada, a regra da recorrência continua e marcadaNoCheckIn é false', () => {
    const atrasado = clienteFabricado({ id: 'atrasado', visits: [{ dataHora: diasAtras(20), resultado: 'VENDA' }] });
    const doDia = clienteFabricado({ id: 'hoje', visits: [{ dataHora: diasAtras(15), resultado: 'VENDA' }] });
    const amanha = clienteFabricado({ id: 'amanha', visits: [{ dataHora: diasAtras(14), resultado: 'VENDA' }] });

    const agenda = montarAgenda([atrasado, doDia, amanha], hoje);

    expect(agenda.atrasadas.map((item) => [item.id, item.diasAtraso, item.marcadaNoCheckIn])).toEqual([
      ['atrasado', 5, false],
    ]);
    expect(agenda.hoje.map((item) => [item.id, item.marcadaNoCheckIn])).toEqual([['hoje', false]]);
    expect(agenda.proximos7Dias.map((item) => [item.id, item.diasAtraso, item.marcadaNoCheckIn])).toEqual([
      ['amanha', -1, false],
    ]);
  });

  it('próximos 7 dias em ordem de data e, no mesmo dia, de cor', () => {
    const verdeEmDoisDias = clienteFabricado({
      id: 'verde-2',
      nomeFantasia: 'Alfa',
      visits: [{ dataHora: diasAtras(1), resultado: 'VENDA' }],
      proximaVisita: diasDepois(2),
    });
    const vermelhoEmDoisDias = clienteFabricado({
      id: 'vermelho-2',
      nomeFantasia: 'Zulu',
      visits: [],
      proximaVisita: diasDepois(2),
    });
    const verdeAmanha = clienteFabricado({
      id: 'verde-1',
      visits: [{ dataHora: diasAtras(1), resultado: 'VENDA' }],
      proximaVisita: diasDepois(1),
    });
    const laranjaEmCincoDias = clienteFabricado({
      id: 'laranja-5',
      visits: [{ dataHora: diasAtras(20), resultado: 'VENDA' }],
      proximaVisita: diasDepois(5),
    });

    const agenda = montarAgenda([laranjaEmCincoDias, verdeEmDoisDias, vermelhoEmDoisDias, verdeAmanha], hoje);

    expect(agenda.proximos7Dias.map((item) => item.id)).toEqual(['verde-1', 'vermelho-2', 'verde-2', 'laranja-5']);
  });

  it('o item traz o endereço do cliente', () => {
    const cliente = clienteFabricado({
      id: 'com-endereco',
      proximaVisita: diasDepois(3),
      endereco: 'Rua Hermann Weege, 100',
    });

    const [item] = montarAgenda([cliente], hoje).proximos7Dias;

    expect(item).toMatchObject({ endereco: 'Rua Hermann Weege, 100' });
  });
});
