import { LIMIAR_SEM_COMPRA_DIAS } from '../src/config/classificacao';
import * as clientRepository from '../src/repositories/client.repository';
import type { ClienteParaAgenda } from '../src/repositories/client.repository';
import * as stockMessageRepository from '../src/repositories/stock-message.repository';
import * as visitRepository from '../src/repositories/visit.repository';
import { fimDoDia, inicioDoDia } from '../src/services/classificacao.service';
import * as erpService from '../src/services/erp.service';
import { obterKpis } from '../src/services/kpis.service';

/**
 * Testes do orquestrador dos indicadores do painel sem banco: repositórios e
 * funções de `erp.service` são substituídos por `jest.spyOn` (mesmo mecanismo de
 * `insights-service.test.ts`). Cada spy rejeita por padrão, para que uma
 * chamada não prevista falhe alto; cada teste stuba só o que o cenário precisa.
 */

const HOJE = new Date('2026-10-07T12:00:00Z');
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function diasAtras(dias: number): Date {
  return new Date(HOJE.getTime() - dias * UM_DIA_MS);
}

type UltimaVisita = ClienteParaAgenda['visits'][number];

function clienteAtivo(id: string, erpId: string | null, ultimaVisita: UltimaVisita | null): ClienteParaAgenda {
  return {
    id,
    nomeFantasia: `Loja ${id}`,
    cidade: 'Pomerode',
    criadoEm: new Date('2026-01-01T12:00:00Z'),
    recorrenciaDias: 15,
    erpId,
    visits: ultimaVisita ? [ultimaVisita] : [],
    representante: { id: 'rep-1', nome: 'Representante' },
    proximaVisita: null,
    lembrete: null,
    endereco: 'Rua XV de Novembro, 100',
  };
}

let listaVisitas: jest.SpiedFunction<typeof visitRepository.listNoPeriodo>;
let listaMensagens: jest.SpiedFunction<typeof stockMessageRepository.listNoPeriodo>;
let listAtivosParaAgenda: jest.SpiedFunction<typeof clientRepository.listAtivosParaAgenda>;
let consultarUltimasVendas: jest.SpiedFunction<typeof erpService.consultarUltimasVendas>;
let erpSimulado: jest.SpiedFunction<typeof erpService.erpSimulado>;

beforeEach(() => {
  const naoStubado = (nome: string) => new Error(`${nome} chamado sem stub neste teste`);

  listaVisitas = jest.spyOn(visitRepository, 'listNoPeriodo').mockRejectedValue(naoStubado('visit.listNoPeriodo'));
  listaMensagens = jest
    .spyOn(stockMessageRepository, 'listNoPeriodo')
    .mockRejectedValue(naoStubado('stockMessage.listNoPeriodo'));
  listAtivosParaAgenda = jest
    .spyOn(clientRepository, 'listAtivosParaAgenda')
    .mockRejectedValue(naoStubado('listAtivosParaAgenda'));
  consultarUltimasVendas = jest
    .spyOn(erpService, 'consultarUltimasVendas')
    .mockRejectedValue(naoStubado('consultarUltimasVendas'));
  erpSimulado = jest.spyOn(erpService, 'erpSimulado').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('obterKpis', () => {
  it('com representanteId restringe visitas, mensagens e ativos à carteira daquele representante', async () => {
    listaVisitas.mockResolvedValue([]);
    listaMensagens.mockResolvedValue([]);
    listAtivosParaAgenda.mockResolvedValue([]);
    consultarUltimasVendas.mockResolvedValue(new Map());

    await obterKpis(30, HOJE, 'rep-b');

    expect(listaVisitas).toHaveBeenCalledWith(inicioDoDia('2026-09-08'), fimDoDia('2026-10-07'), 'rep-b');
    expect(listaMensagens).toHaveBeenCalledWith(inicioDoDia('2026-09-08'), fimDoDia('2026-10-07'), 'rep-b');
    expect(listAtivosParaAgenda).toHaveBeenCalledWith('rep-b');
  });

  it('consulta visitas e mensagens com inicioDoDia("2026-09-08") e fimDoDia("2026-10-07") para 30 dias, e sem representanteId não filtra carteira', async () => {
    listaVisitas.mockResolvedValue([]);
    listaMensagens.mockResolvedValue([]);
    listAtivosParaAgenda.mockResolvedValue([clienteAtivo('a', 'ERP-A', null)]);
    consultarUltimasVendas.mockResolvedValue(new Map());

    await obterKpis(30, HOJE);

    expect(listaVisitas).toHaveBeenCalledTimes(1);
    expect(listaVisitas).toHaveBeenCalledWith(inicioDoDia('2026-09-08'), fimDoDia('2026-10-07'), undefined);
    expect(listaMensagens).toHaveBeenCalledTimes(1);
    expect(listaMensagens).toHaveBeenCalledWith(inicioDoDia('2026-09-08'), fimDoDia('2026-10-07'), undefined);
    expect(listAtivosParaAgenda).toHaveBeenCalledTimes(1);
    expect(listAtivosParaAgenda).toHaveBeenCalledWith(undefined);
    expect(consultarUltimasVendas).toHaveBeenCalledWith(['ERP-A']);
  });

  it('monta o DTO: periodo { 30, inicio, fim }, clientesAtivos, visitas.total/mediaPorCliente, taxaDeRegistro, conversaoEmVendas, inativos', async () => {
    // a: última visita há 2 dias com VENDA → VERDE; b: há 20 dias sem venda → LARANJA; c: sem visita → VERMELHO.
    listAtivosParaAgenda.mockResolvedValue([
      clienteAtivo('a', 'ERP-A', { dataHora: diasAtras(2), resultado: 'VENDA' }),
      clienteAtivo('b', 'ERP-B', { dataHora: diasAtras(20), resultado: 'SEM_VENDA' }),
      clienteAtivo('c', 'ERP-C', null),
    ]);
    consultarUltimasVendas.mockResolvedValue(new Map());
    // Visitas de a (VENDA) e b (SEM_VENDA); mensagem só do cliente c.
    listaVisitas.mockResolvedValue([
      { clientId: 'a', resultado: 'VENDA', dataHora: diasAtras(2), representanteId: 'rep-1' },
      { clientId: 'b', resultado: 'SEM_VENDA', dataHora: diasAtras(20), representanteId: 'rep-1' },
    ]);
    listaMensagens.mockResolvedValue([{ clientId: 'c' }]);

    await expect(obterKpis(30, HOJE)).resolves.toEqual({
      periodo: { dias: 30, inicio: '2026-09-08', fim: '2026-10-07' },
      clientesAtivos: 3,
      visitas: { total: 2, mediaPorCliente: 0.7 }, // 2 / 3 = 0,666… → 0,7
      taxaDeRegistro: { numerador: 3, denominador: 3, percentual: 100 },
      conversaoEmVendas: { numerador: 1, denominador: 2, percentual: 50 },
      inativos: { total: 2, distribuicao: { VERDE: 1, AMARELO: 0, LARANJA: 1, VERMELHO: 1 } },
      semDados: false,
      simulado: true,
    });
  });

  it('cor composta: ativo VERDE pela visita mas com última compra há 70 dias → LARANJA → inativos.total 1 e distribuicao.LARANJA 1', async () => {
    expect(LIMIAR_SEM_COMPRA_DIAS).toBeLessThan(70); // premissa do cenário

    listAtivosParaAgenda.mockResolvedValue([
      clienteAtivo('a', 'ERP-A', { dataHora: diasAtras(3), resultado: 'VENDA' }),
    ]);
    consultarUltimasVendas.mockResolvedValue(new Map([['ERP-A', diasAtras(70)]]));
    listaVisitas.mockResolvedValue([{ clientId: 'a', resultado: 'VENDA', dataHora: diasAtras(3), representanteId: 'rep-1' }]);
    listaMensagens.mockResolvedValue([]);

    const kpis = await obterKpis(30, HOJE);

    expect(consultarUltimasVendas).toHaveBeenCalledWith(['ERP-A']);
    expect(kpis.inativos).toEqual({ total: 1, distribuicao: { VERDE: 0, AMARELO: 0, LARANJA: 1, VERMELHO: 0 } });
  });

  it('ERP indisponível (consultarUltimasVendas devolve Map com null) mantém a cor base; simulado reflete erpSimulado()', async () => {
    listAtivosParaAgenda.mockResolvedValue([
      clienteAtivo('a', 'ERP-A', { dataHora: diasAtras(3), resultado: 'VENDA' }),
    ]);
    consultarUltimasVendas.mockResolvedValue(new Map([['ERP-A', null]]));
    listaVisitas.mockResolvedValue([{ clientId: 'a', resultado: 'VENDA', dataHora: diasAtras(3), representanteId: 'rep-1' }]);
    listaMensagens.mockResolvedValue([]);

    erpSimulado.mockReturnValue(false);
    const real = await obterKpis(30, HOJE);

    expect(real.inativos).toEqual({ total: 0, distribuicao: { VERDE: 1, AMARELO: 0, LARANJA: 0, VERMELHO: 0 } });
    expect(real.simulado).toBe(false);

    erpSimulado.mockReturnValue(true);

    await expect(obterKpis(30, HOJE)).resolves.toMatchObject({ simulado: true });
  });

  it('visita de clientId que não está entre os ativos conta em visitas.total e na conversão, não na taxa', async () => {
    listAtivosParaAgenda.mockResolvedValue([
      clienteAtivo('a', 'ERP-A', null),
      clienteAtivo('b', 'ERP-B', null),
    ]);
    consultarUltimasVendas.mockResolvedValue(new Map());
    listaVisitas.mockResolvedValue([
      { clientId: 'a', resultado: 'SEM_VENDA', dataHora: diasAtras(5), representanteId: 'rep-1' },
      { clientId: 'inativado', resultado: 'VENDA', dataHora: diasAtras(6), representanteId: 'rep-1' },
    ]);
    listaMensagens.mockResolvedValue([]);

    const kpis = await obterKpis(30, HOJE);

    expect(kpis.visitas).toEqual({ total: 2, mediaPorCliente: 1 }); // 2 visitas / 2 ativos
    expect(kpis.conversaoEmVendas).toEqual({ numerador: 1, denominador: 2, percentual: 50 });
    expect(kpis.taxaDeRegistro).toEqual({ numerador: 1, denominador: 2, percentual: 50 }); // só 'a' é ativo
  });

  it('sem visitas nem mensagens → semDados true, percentuais null, inativos pela cor atual', async () => {
    // Sem nenhuma visita registrada, a cor atual de cada ativo é VERMELHO.
    listAtivosParaAgenda.mockResolvedValue([
      clienteAtivo('a', 'ERP-A', null),
      clienteAtivo('b', null, null),
    ]);
    consultarUltimasVendas.mockResolvedValue(new Map());
    listaVisitas.mockResolvedValue([]);
    listaMensagens.mockResolvedValue([]);

    const comAtivos = await obterKpis(30, HOJE);

    expect(comAtivos).toMatchObject({
      clientesAtivos: 2,
      visitas: { total: 0, mediaPorCliente: 0 },
      // Com ativos o denominador não é zero: 0 de 2 é 0%, não null.
      taxaDeRegistro: { numerador: 0, denominador: 2, percentual: 0 },
      conversaoEmVendas: { numerador: 0, denominador: 0, percentual: null },
      inativos: { total: 2, distribuicao: { VERDE: 0, AMARELO: 0, LARANJA: 0, VERMELHO: 2 } },
      semDados: true,
    });

    listAtivosParaAgenda.mockResolvedValue([]);

    const semAtivos = await obterKpis(30, HOJE);

    expect(semAtivos).toMatchObject({
      clientesAtivos: 0,
      visitas: { total: 0, mediaPorCliente: null },
      taxaDeRegistro: { numerador: 0, denominador: 0, percentual: null },
      conversaoEmVendas: { numerador: 0, denominador: 0, percentual: null },
      inativos: { total: 0 },
      semDados: true,
    });
  });
});
