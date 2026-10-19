import type { SeasonalEvent } from '@prisma/client';
import {
  DIAS_DE_BASE,
  JANELA_PICO_DIAS,
  MAX_PRODUTOS_MAIS_COMPRADOS,
  PRODUTOS_SUGERIDOS,
  type EventoSazonal,
} from '../src/config/sazonalidade';
import { AppError } from '../src/errors/AppError';
import { ErrorCode } from '../src/errors/errorCodes';
import type { Sale } from '../src/providers/erp/ErpProvider';
import { gerarHistoricoErp } from '../src/providers/erp/mock/gerador';
import * as clientRepository from '../src/repositories/client.repository';
import type { ClienteParaAgenda, ClientComContatos } from '../src/repositories/client.repository';
import * as seasonalEventRepository from '../src/repositories/seasonal-event.repository';
import { fimDoDia, inicioDoDia, somarDias } from '../src/services/classificacao.service';
import * as erpService from '../src/services/erp.service';
import type { ItemBaixo } from '../src/services/erp.service';
import {
  acaoPorVariacao,
  calcularVariacao,
  janelaDoAnoAnterior,
  montarTextoDaSugestao,
  periodoBase,
  produtosMaisComprados,
  totalNaJanela,
  vendasNaJanela,
  type Janela,
} from '../src/services/insights.regras';
import { obterAlertasDeProducao, obterInsights, type InsightsDTO } from '../src/services/insights.service';

/**
 * Testes do orquestrador de insights/alertas sem banco: todo repositório e
 * toda função de `erp.service` usados pelo service são substituídos por
 * `jest.spyOn` (mesmo mecanismo de `agenda-job.test.ts`). Por padrão cada spy
 * rejeita, para que uma chamada não prevista falhe alto em vez de cair no
 * banco ou no ERP de verdade; cada teste stuba só o que o cenário precisa.
 */

const HOJE = new Date('2026-10-07T12:00:00Z');
const CLIENTE_ID = 'cliente-1';
/** A regra de carteira não barra o gestor; os casos de carteira estão em `insights.test.ts`. */
const GESTOR = { id: 'gestor-1', role: 'GESTOR' as const };

/** Linha de `SeasonalEvent` como o Prisma devolve: colunas `@db.Date` à meia-noite UTC. */
function eventoDoBanco(id: string, nome: string, chave: EventoSazonal, dataFim: string): SeasonalEvent {
  return {
    id,
    nome,
    chave,
    dataInicio: new Date(`${somarDias(dataFim, -JANELA_PICO_DIAS)}T00:00:00Z`),
    dataFim: new Date(`${dataFim}T00:00:00Z`),
    produtosSugeridos: PRODUTOS_SUGERIDOS[chave],
  };
}

const NATAL_2026 = eventoDoBanco('natal-2026', 'Natal 2026', 'NATAL', '2026-12-25');
const PASCOA_2027 = eventoDoBanco('pascoa-2027', 'Páscoa 2027', 'PASCOA', '2027-03-28');
const MAES_2027 = eventoDoBanco('maes-2027', 'Dia das Mães 2027', 'DIA_DAS_MAES', '2027-05-09');
const NAMORADOS_2027 = eventoDoBanco('namorados-2027', 'Dia dos Namorados 2027', 'NAMORADOS', '2027-06-12');

/** Só os campos que o service lê do cliente da ficha. */
function clienteDaFicha(erpId: string | null): ClientComContatos {
  return { id: CLIENTE_ID, erpId } as ClientComContatos;
}

function clienteAtivo(id: string, erpId: string | null): ClienteParaAgenda {
  return {
    id,
    nomeFantasia: `Loja ${id}`,
    cidade: 'Pomerode',
    criadoEm: new Date('2026-01-01T12:00:00Z'),
    recorrenciaDias: 15,
    erpId,
    visits: [],
    representante: { id: 'rep-1', nome: 'Representante' },
    proximaVisita: null,
    lembrete: null,
    endereco: 'Rua XV de Novembro, 100',
  };
}

const ATUALIZADO_EM = new Date('2026-10-01T12:00:00Z');

function itemBaixo(sku: string, nome: string, quantidade: number): ItemBaixo {
  return { sku, nome, quantidade, atualizadoEm: ATUALIZADO_EM };
}

const cx = (quantidade: number) => itemBaixo('CX-PRESENTE', 'Caixa presente sortida', quantidade);
const paoDeMel = (quantidade: number) => itemBaixo('PAO-MEL', 'Pães de mel', quantidade);

/**
 * Oráculo de uma sugestão: as mesmas regras puras aplicadas às mesmas vendas
 * do mock. Falha se o fixture não tiver histórico na janela — os cenários que
 * o usam precisam produzir sugestão, não `eventosSemHistorico`.
 */
function comparacaoEsperada(vendas: Sale[], janela: Janela) {
  const diasJanela = JANELA_PICO_DIAS + 1;
  const totalJanela = totalNaJanela(vendas, janela);
  const totalBase = totalNaJanela(vendas, periodoBase(janela));
  const variacao = calcularVariacao(totalJanela, totalBase, diasJanela);

  if (variacao === null) {
    throw new Error('Fixture sem histórico na janela: escolha outro erpId para este cenário.');
  }

  const variacaoPercentual = Math.round(variacao * 100);

  return {
    totalJanela,
    mediaNaJanela: Math.round(((totalBase * diasJanela) / DIAS_DE_BASE) * 100) / 100,
    variacaoPercentual,
    acao: acaoPorVariacao(variacaoPercentual / 100),
    produtos: produtosMaisComprados(vendasNaJanela(vendas, janela), MAX_PRODUTOS_MAIS_COMPRADOS),
  };
}

function sugestoesDe(resultado: InsightsDTO) {
  if (resultado.status !== 'OK') {
    throw new Error(`Esperava status OK, veio ${resultado.status}.`);
  }

  return resultado.sugestoes;
}

let findById: jest.SpiedFunction<typeof clientRepository.findById>;
let listAtivosParaAgenda: jest.SpiedFunction<typeof clientRepository.listAtivosParaAgenda>;
let findNoIntervalo: jest.SpiedFunction<typeof seasonalEventRepository.findNoIntervalo>;
let consultarVendas: jest.SpiedFunction<typeof erpService.consultarVendas>;
let consultarItensBaixosEmLote: jest.SpiedFunction<typeof erpService.consultarItensBaixosEmLote>;
let erpSimulado: jest.SpiedFunction<typeof erpService.erpSimulado>;

/** `consultarVendas` respondendo como o `MockErpProvider`: histórico do gerador filtrado pelo período recebido. */
function vendasDoMock(hoje: Date): void {
  consultarVendas.mockImplementation(async (erpId, periodo) =>
    gerarHistoricoErp(erpId, hoje).vendas.filter((venda) => venda.data >= periodo.inicio && venda.data <= periodo.fim),
  );
}

beforeEach(() => {
  const naoStubado = (nome: string) => new Error(`${nome} chamado sem stub neste teste`);

  findById = jest.spyOn(clientRepository, 'findById').mockRejectedValue(naoStubado('findById'));
  listAtivosParaAgenda = jest
    .spyOn(clientRepository, 'listAtivosParaAgenda')
    .mockRejectedValue(naoStubado('listAtivosParaAgenda'));
  findNoIntervalo = jest
    .spyOn(seasonalEventRepository, 'findNoIntervalo')
    .mockRejectedValue(naoStubado('findNoIntervalo'));
  consultarVendas = jest.spyOn(erpService, 'consultarVendas').mockRejectedValue(naoStubado('consultarVendas'));
  consultarItensBaixosEmLote = jest
    .spyOn(erpService, 'consultarItensBaixosEmLote')
    .mockRejectedValue(naoStubado('consultarItensBaixosEmLote'));
  erpSimulado = jest.spyOn(erpService, 'erpSimulado').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('obterInsights', () => {
  it('404 cliente inexistente; SEM_ERP_ID sem erpId', async () => {
    findById.mockResolvedValueOnce(null);

    const erro = await obterInsights('nao-existe', GESTOR, 90, HOJE).catch((err: unknown) => err);

    expect(erro).toBeInstanceOf(AppError);
    expect(erro).toMatchObject({ code: ErrorCode.NOT_FOUND, statusCode: 404, message: 'Cliente não encontrado.' });

    findById.mockResolvedValueOnce(clienteDaFicha(null));

    await expect(obterInsights(CLIENTE_ID, GESTOR, 90, HOJE)).resolves.toEqual({ status: 'SEM_ERP_ID' });
    expect(findById).toHaveBeenCalledWith(CLIENTE_ID);
    expect(findNoIntervalo).not.toHaveBeenCalled();
    expect(consultarVendas).not.toHaveBeenCalled();
  });

  it('sem eventos no horizonte: OK com sugestoes [] e eventosSemHistorico [], e consultarVendas não é chamada', async () => {
    findById.mockResolvedValue(clienteDaFicha('ERP-1001'));
    findNoIntervalo.mockResolvedValue([]);

    await expect(obterInsights(CLIENTE_ID, GESTOR, 90, HOJE)).resolves.toEqual({
      status: 'OK',
      simulado: true,
      horizonteDias: 90,
      sugestoes: [],
      eventosSemHistorico: [],
    });
    expect(findNoIntervalo).toHaveBeenCalledWith('2026-10-07', '2027-01-05');
    expect(consultarVendas).not.toHaveBeenCalled();
  });

  it('Natal 2026 (dataFim 25/12) com ERP-1001: uma chamada a consultarVendas com inicio = inicioDoDia("2024-11-25") e fim = fimDoDia("2025-12-25"); sugestão com evento.diasAteEvento 79, periodoComparado 2025-11-25..2025-12-25, variacaoPercentual e acao coerentes com calcularVariacao/acaoPorVariacao sobre as mesmas vendas, produtosMaisComprados com até 3 itens', async () => {
    findById.mockResolvedValue(clienteDaFicha('ERP-1001'));
    findNoIntervalo.mockResolvedValue([NATAL_2026]);
    vendasDoMock(HOJE);

    const resultado = await obterInsights(CLIENTE_ID, GESTOR, 90, HOJE);

    expect(consultarVendas).toHaveBeenCalledTimes(1);
    expect(consultarVendas).toHaveBeenCalledWith('ERP-1001', {
      inicio: inicioDoDia('2024-11-25'),
      fim: fimDoDia('2025-12-25'),
    });

    const periodoComparado = { inicio: '2025-11-25', fim: '2025-12-25' };
    const esperado = comparacaoEsperada(gerarHistoricoErp('ERP-1001', HOJE).vendas, periodoComparado);
    const evento = { id: 'natal-2026', nome: 'Natal 2026', dataEvento: '2026-12-25', diasAteEvento: 79 };
    const { texto } = montarTextoDaSugestao(
      { ...evento, chave: 'NATAL', produtosSugeridos: NATAL_2026.produtosSugeridos },
      esperado.acao,
      esperado.variacaoPercentual,
      esperado.produtos,
    );

    expect(resultado).toEqual({
      status: 'OK',
      simulado: true,
      horizonteDias: 90,
      eventosSemHistorico: [],
      sugestoes: [
        {
          evento,
          acao: esperado.acao,
          variacaoPercentual: esperado.variacaoPercentual,
          periodoComparado,
          comprasNaJanela: esperado.totalJanela,
          mediaNaJanela: esperado.mediaNaJanela,
          produtosMaisComprados: esperado.produtos,
          titulo: 'Natal em 79 dias',
          texto,
        },
      ],
    });
    expect(Number.isInteger(esperado.variacaoPercentual)).toBe(true);
    expect(esperado.produtos.length).toBeGreaterThan(0);
    expect(esperado.produtos.length).toBeLessThanOrEqual(MAX_PRODUTOS_MAIS_COMPRADOS);
  });

  it('variação de 19,6% vira variacaoPercentual 20 e AUMENTAR_OFERTA (ação decidida no percentual arredondado); mediaNaJanela em centavos; produtos só das vendas da janela', async () => {
    findById.mockResolvedValue(clienteDaFicha('ERP-1001'));
    findNoIntervalo.mockResolvedValue([NATAL_2026]);
    // Base do Natal 2026: 2024-11-25..2025-11-24; janela: 2025-11-25..2025-12-25.
    // Média na janela = 1000 × 31 / 365 = 84,9315…; 101,58 / 84,9315… − 1 = 0,19603 → 20%.
    consultarVendas.mockResolvedValue([
      { data: new Date('2025-06-01T12:00:00Z'), valor: 1000, produtos: [{ sku: 'TRUF-70', nome: 'Trufas 70% cacau', quantidade: 50 }] },
      { data: new Date('2025-12-01T12:00:00Z'), valor: 101.58, produtos: [{ sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 3 }] },
    ]);

    const [sugestao] = sugestoesDe(await obterInsights(CLIENTE_ID, GESTOR, 90, HOJE));

    expect(acaoPorVariacao(0.19603)).toBe('CRIAR_PROMOCAO'); // sem arredondar, a ação discordaria do número exibido
    expect(sugestao).toMatchObject({
      variacaoPercentual: 20,
      acao: 'AUMENTAR_OFERTA',
      comprasNaJanela: 101.58,
      mediaNaJanela: 84.93,
      produtosMaisComprados: [{ sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 3 }],
      texto: 'Comprou 20% a mais no mesmo período do ano passado. Aumentar a oferta de Caixa presente sortida.',
    });
  });

  it('dois eventos (Dia das Mães e Namorados 2027, hoje 2027-03-01, horizonte 180): uma única consultarVendas do menor periodoBase.inicio ao maior janela.fim; duas sugestões em ordem de diasAteEvento', async () => {
    const hoje = new Date('2027-03-01T12:00:00Z');
    findById.mockResolvedValue(clienteDaFicha('ERP-1003'));
    // Ordem invertida de propósito: a ordem das sugestões não depende da do repositório.
    findNoIntervalo.mockResolvedValue([NAMORADOS_2027, MAES_2027]);
    vendasDoMock(hoje);

    const resultado = await obterInsights(CLIENTE_ID, GESTOR, 180, hoje);

    // Base do Dia das Mães 2026 (10/05) começa em 2025-04-10; janela dos Namorados 2026 termina em 2026-06-12.
    expect(consultarVendas).toHaveBeenCalledTimes(1);
    expect(consultarVendas).toHaveBeenCalledWith('ERP-1003', {
      inicio: inicioDoDia('2025-04-10'),
      fim: fimDoDia('2026-06-12'),
    });
    expect(resultado).toMatchObject({ status: 'OK', horizonteDias: 180, eventosSemHistorico: [] });

    const sugestoes = sugestoesDe(resultado);
    const vendas = gerarHistoricoErp('ERP-1003', hoje).vendas;
    const maes = comparacaoEsperada(vendas, janelaDoAnoAnterior('DIA_DAS_MAES', 2027));
    const namorados = comparacaoEsperada(vendas, janelaDoAnoAnterior('NAMORADOS', 2027));

    expect(
      sugestoes.map((sugestao) => [sugestao.evento.id, sugestao.evento.diasAteEvento, sugestao.periodoComparado]),
    ).toEqual([
      ['maes-2027', 69, { inicio: '2026-04-10', fim: '2026-05-10' }],
      ['namorados-2027', 103, { inicio: '2026-05-13', fim: '2026-06-12' }],
    ]);
    expect(sugestoes.map((sugestao) => [sugestao.variacaoPercentual, sugestao.acao])).toEqual([
      [maes.variacaoPercentual, maes.acao],
      [namorados.variacaoPercentual, namorados.acao],
    ]);
    expect(sugestoes.map((sugestao) => sugestao.produtosMaisComprados)).toEqual([maes.produtos, namorados.produtos]);
  });

  it('ERP-1000-0 (vendas vazias): todos os eventos em eventosSemHistorico', async () => {
    findById.mockResolvedValue(clienteDaFicha('ERP-1000-0'));
    findNoIntervalo.mockResolvedValue([PASCOA_2027, NATAL_2026]);
    vendasDoMock(HOJE);

    await expect(obterInsights(CLIENTE_ID, GESTOR, 180, HOJE)).resolves.toEqual({
      status: 'OK',
      simulado: true,
      horizonteDias: 180,
      sugestoes: [],
      eventosSemHistorico: [
        { id: 'natal-2026', nome: 'Natal 2026', diasAteEvento: 79 },
        { id: 'pascoa-2027', nome: 'Páscoa 2027', diasAteEvento: 172 },
      ],
    });
    expect(consultarVendas).toHaveBeenCalledTimes(1);
  });

  it('consultarVendas null → INDISPONIVEL', async () => {
    findById.mockResolvedValue(clienteDaFicha('ERP-1001'));
    findNoIntervalo.mockResolvedValue([NATAL_2026]);
    consultarVendas.mockResolvedValue(null);

    await expect(obterInsights(CLIENTE_ID, GESTOR, 90, HOJE)).resolves.toEqual({ status: 'INDISPONIVEL' });
  });

  it('simulado reflete erpSimulado()', async () => {
    findById.mockResolvedValue(clienteDaFicha('ERP-1001'));
    findNoIntervalo.mockResolvedValue([]);

    erpSimulado.mockReturnValue(false);
    await expect(obterInsights(CLIENTE_ID, GESTOR, 90, HOJE)).resolves.toMatchObject({ status: 'OK', simulado: false });

    erpSimulado.mockReturnValue(true);
    await expect(obterInsights(CLIENTE_ID, GESTOR, 90, HOJE)).resolves.toMatchObject({ status: 'OK', simulado: true });
  });
});

describe('obterAlertasDeProducao', () => {
  it('sem eventos no horizonte: alertas [] e consultarItensBaixosEmLote não é chamada', async () => {
    findNoIntervalo.mockResolvedValue([]);
    erpSimulado.mockReturnValue(false);

    await expect(obterAlertasDeProducao(90, HOJE)).resolves.toEqual({
      simulado: false,
      horizonteDias: 90,
      eventos: [],
      alertas: [],
      clientesConsultados: 0,
      clientesIndisponiveis: 0,
    });
    expect(findNoIntervalo).toHaveBeenCalledWith('2026-10-07', '2027-01-05');
    expect(listAtivosParaAgenda).not.toHaveBeenCalled();
    expect(consultarItensBaixosEmLote).not.toHaveBeenCalled();
  });

  it('ignora clientes sem erpId; clientesConsultados conta só os com erpId; clientesIndisponiveis conta os clientes cujo erpId ficou em indisponiveis', async () => {
    findNoIntervalo.mockResolvedValue([NATAL_2026]);
    listAtivosParaAgenda.mockResolvedValue([
      clienteAtivo('a', 'ERP-1001'),
      clienteAtivo('b', null),
      clienteAtivo('c', 'ERP-1002'),
      clienteAtivo('d', 'ERP-1003'),
      // Mesmo erpId de "c": o ERP é consultado uma vez, mas são dois clientes sem resposta.
      clienteAtivo('e', 'ERP-1002'),
    ]);
    consultarItensBaixosEmLote.mockResolvedValue({
      itensPorErpId: new Map([
        ['ERP-1001', [cx(4)]],
        ['ERP-1003', []],
      ]),
      indisponiveis: ['ERP-1002'],
    });

    const resultado = await obterAlertasDeProducao(90, HOJE);

    expect(listAtivosParaAgenda).toHaveBeenCalledWith(undefined);
    expect(consultarItensBaixosEmLote).toHaveBeenCalledTimes(1);
    expect(consultarItensBaixosEmLote).toHaveBeenCalledWith(['ERP-1001', 'ERP-1002', 'ERP-1003', 'ERP-1002']);
    expect(resultado.clientesConsultados).toBe(4);
    expect(resultado.clientesIndisponiveis).toBe(2);
    expect(resultado.alertas.flatMap((alerta) => alerta.clientes.map((cliente) => cliente.id))).toEqual(['a']);
  });

  it('alertas agrupados por evento × produto a partir dos itens baixos stubados (CX-PRESENTE em dois clientes antes do Natal → um alerta com dois clientes)', async () => {
    findNoIntervalo.mockResolvedValue([NATAL_2026]);
    listAtivosParaAgenda.mockResolvedValue([clienteAtivo('a', 'ERP-1001'), clienteAtivo('b', 'ERP-1002')]);
    consultarItensBaixosEmLote.mockResolvedValue({
      itensPorErpId: new Map([
        ['ERP-1001', [cx(4), paoDeMel(2)]],
        ['ERP-1002', [cx(2)]],
      ]),
      indisponiveis: [],
    });

    const resultado = await obterAlertasDeProducao(90, HOJE);

    expect(resultado).toMatchObject({ simulado: true, horizonteDias: 90, clientesConsultados: 2, clientesIndisponiveis: 0 });
    expect(resultado.alertas).toEqual([
      {
        evento: { id: 'natal-2026', nome: 'Natal 2026', dataEvento: '2026-12-25', diasAteEvento: 79 },
        produto: { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida' },
        clientes: [
          { id: 'b', nomeFantasia: 'Loja b', cidade: 'Pomerode', quantidade: 2, atualizadoEm: ATUALIZADO_EM.toISOString() },
          { id: 'a', nomeFantasia: 'Loja a', cidade: 'Pomerode', quantidade: 4, atualizadoEm: ATUALIZADO_EM.toISOString() },
        ],
      },
    ]);
  });

  it('com representanteId lista só os clientes ativos daquela carteira', async () => {
    findNoIntervalo.mockResolvedValue([NATAL_2026]);
    listAtivosParaAgenda.mockResolvedValue([]);
    consultarItensBaixosEmLote.mockResolvedValue({ itensPorErpId: new Map(), indisponiveis: [] });

    await obterAlertasDeProducao(90, HOJE, 'rep-b');

    expect(listAtivosParaAgenda).toHaveBeenCalledWith('rep-b');
  });

  it('eventos do horizonte vêm com produtosSugeridos e dataEvento AAAA-MM-DD', async () => {
    findNoIntervalo.mockResolvedValue([PASCOA_2027, NATAL_2026]);
    listAtivosParaAgenda.mockResolvedValue([]);
    consultarItensBaixosEmLote.mockResolvedValue({ itensPorErpId: new Map(), indisponiveis: [] });

    const resultado = await obterAlertasDeProducao(180, HOJE);

    expect(findNoIntervalo).toHaveBeenCalledWith('2026-10-07', '2027-04-05');
    expect(resultado.eventos).toEqual([
      {
        id: 'natal-2026',
        nome: 'Natal 2026',
        dataEvento: '2026-12-25',
        diasAteEvento: 79,
        produtosSugeridos: PRODUTOS_SUGERIDOS.NATAL,
      },
      {
        id: 'pascoa-2027',
        nome: 'Páscoa 2027',
        dataEvento: '2027-03-28',
        diasAteEvento: 172,
        produtosSugeridos: PRODUTOS_SUGERIDOS.PASCOA,
      },
    ]);
    expect(resultado).toMatchObject({ horizonteDias: 180, alertas: [], clientesConsultados: 0, clientesIndisponiveis: 0 });
  });
});
