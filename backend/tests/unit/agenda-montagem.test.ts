import type { ClienteParaAgenda } from '../../src/repositories/client.repository';
import { montarAgenda } from '../../src/services/agenda.service';
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
    visits: [],
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
});
