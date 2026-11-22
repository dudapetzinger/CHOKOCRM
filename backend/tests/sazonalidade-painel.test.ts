import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { LIMITE_ESTOQUE_BAIXO } from '../src/config/sazonalidade';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ErpIndisponivelError, type Sale, type StockSnapshot } from '../src/providers/erp/ErpProvider';
import * as seasonalEventRepository from '../src/repositories/seasonal-event.repository';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

const SENHA_PADRAO = 'chokocrm123';
/** 20/11/2026, meio-dia em São Paulo: o Natal é daqui a 35 dias e a Páscoa de 2027 (28/03), a 128. */
const AGORA = new Date('2026-11-20T15:00:00.000Z');

let tokenGestor: string;
let tokenA: string;
let repAId: string;
let repBId: string;
let clienteA1: string;
let clienteB1: string;

async function logar(usuario: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarCliente(
  cnpj: string,
  nomeFantasia: string,
  cidade: string,
  representanteId: string,
  erpId: string | null,
  ativo = true,
): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Ltda`,
      nomeFantasia,
      cnpj,
      cidade,
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato${cnpj}@cliente.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId,
      ativo,
    },
  });
  return cliente.id;
}

/** Data comemorativa com o dia (`dataFim`) informado e a janela de 30 dias antes. */
async function criarData(nome: string, chave: 'NATAL' | 'PASCOA', dia: string): Promise<void> {
  const dataFim = new Date(`${dia}T12:00:00.000Z`);
  const dataInicio = new Date(dataFim);
  dataInicio.setUTCDate(dataInicio.getUTCDate() - 30);

  await seasonalEventRepository.upsertMany([
    { nome, chave, dataInicio, dataFim, produtosSugeridos: ['caixas presente'] },
  ]);
}

/** Venda ao meio-dia em São Paulo do dia informado. */
function venda(dia: string, valor: number): Sale {
  return { data: new Date(`${dia}T12:00:00.000-03:00`), valor, produtos: [] };
}

function item(dia: string, sku: string, nome: string, quantidade: number): StockSnapshot {
  return {
    data: new Date(`${dia}T12:00:00.000Z`),
    sku,
    nome,
    quantidade,
    nivel: quantidade < LIMITE_ESTOQUE_BAIXO ? 'BAIXO' : 'NORMAL',
  };
}

/**
 * Vendas conhecidas por `erpId`. Natal de 2025: janela de 25/11/2025 a
 * 25/12/2025; Páscoa de 2026 (05/04): de 06/03/2026 a 05/04/2026.
 */
const VENDAS: Record<string, Sale[]> = {
  'ERP-1001': [
    venda('2026-12-05', 300),
    venda('2026-11-19', 80),
    venda('2025-12-10', 1000),
    venda('2025-11-24', 500),
  ],
  'ERP-1002': [venda('2026-03-20', 700), venda('2025-12-25', 200.5)],
  'ERP-1003': [venda('2026-11-30', 50), venda('2025-12-01', 4000)],
};

/** Estoque por `erpId`: ERP-1002 não informa estoque; o snapshot antigo de ERP-1001 não conta. */
const ESTOQUE: Record<string, StockSnapshot[]> = {
  'ERP-1001': [
    item('2026-11-15', 'CX-PRESENTE', 'Caixa presente', 3),
    item('2026-11-15', 'BOMB-SORT', 'Bombons sortidos', 25),
    item('2026-11-15', 'TRUF-70', 'Trufas 70%', 1),
    item('2026-11-01', 'BOMB-SORT', 'Bombons sortidos', 2),
  ],
  'ERP-1002': [],
  'ERP-1003': [
    item('2026-11-15', 'CX-PRESENTE', 'Caixa presente', 8),
    item('2026-11-15', 'BOMB-SORT', 'Bombons sortidos', 5),
  ],
};

let getSales: jest.SpiedFunction<typeof erpProvider.getSales>;
let getStockHistory: jest.SpiedFunction<typeof erpProvider.getStockHistory>;

function getSazonalidade(query: Record<string, string> = {}, token = tokenGestor): request.Test {
  return request(app).get('/insights/sazonalidade').query(query).set('Authorization', `Bearer ${token}`);
}

function getVendasMensais(query: Record<string, string> = {}, token = tokenGestor): request.Test {
  return request(app).get('/dashboard/vendas-mensais').query(query).set('Authorization', `Bearer ${token}`);
}

beforeEach(async () => {
  fixarRelogio(AGORA);
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', usuario: 'ricardo.sazonal-teste', role: 'GESTOR', senhaHash },
  });
  repAId = (
    await prisma.user.create({
      data: { nome: 'Eduarda Fischer', usuario: 'eduarda.sazonal-teste', role: 'REPRESENTANTE', senhaHash },
    })
  ).id;
  repBId = (
    await prisma.user.create({
      data: { nome: 'Bruno Alencar', usuario: 'bruno.sazonal-teste', role: 'REPRESENTANTE', senhaHash },
    })
  ).id;

  tokenGestor = await logar('ricardo.sazonal-teste');
  tokenA = await logar('eduarda.sazonal-teste');

  // Carteira A: dois com erpId, um sem (sem chave no mock) e um inativo; B: um com erpId.
  clienteA1 = await criarCliente('11222333000181', 'Emporio Pomerode', 'Pomerode', repAId, 'ERP-1001');
  await criarCliente('11222333000262', 'Padaria Vale Europeu', 'Blumenau', repAId, 'ERP-1002');
  await criarCliente('11222333000343', 'Doceria Sem ERP', 'Timbo', repAId, null);
  await criarCliente('11222333000424', 'Armazem Inativo', 'Timbo', repAId, 'ERP-1004', false);
  clienteB1 = await criarCliente('11222333000505', 'Bombons Indaial', 'Indaial', repBId, 'ERP-1003');

  await criarData('Natal 2025', 'NATAL', '2025-12-25');
  await criarData('Natal 2026', 'NATAL', '2026-12-25');
  await criarData('Páscoa 2027', 'PASCOA', '2027-03-28');

  getSales = jest
    .spyOn(erpProvider, 'getSales')
    .mockImplementation(async (chave, periodo) =>
      (VENDAS[chave] ?? []).filter(({ data }) => data >= periodo.inicio && data <= periodo.fim),
    );
  getStockHistory = jest
    .spyOn(erpProvider, 'getStockHistory')
    .mockImplementation(async (chave) => ESTOQUE[chave] ?? []);
});

afterEach(() => {
  jest.restoreAllMocks();
  liberarRelogio();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /insights/sazonalidade', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/insights/sazonalidade');

    expect(res.status).toBe(401);
  });

  it.each<[Record<string, string>, string]>([
    [{ horizonteDias: '10' }, 'horizonte abaixo do mínimo'],
    [{ horizonteDias: '400' }, 'horizonte acima do máximo'],
    [{ horizonteDias: 'abc' }, 'horizonte não numérico'],
    [{ representanteId: 'abc' }, 'representante que não é uuid'],
  ])('%o (%s) responde 400 VALIDATION_ERROR', async (query) => {
    const res = await getSazonalidade(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('o gestor recebe a data do horizonte com janela, vendas, campanhas e estoque baixo por produto', async () => {
    await prisma.campaign.createMany({
      data: [
        {
          nome: 'Promoção de Natal',
          tipo: 'PROMOCAO',
          inicio: new Date('2026-12-01T00:00:00Z'),
          fim: new Date('2026-12-24T00:00:00Z'),
          desconto: 12,
          produtos: [],
        },
        {
          nome: 'Campanha de outubro',
          tipo: 'CAMPANHA',
          inicio: new Date('2026-10-01T00:00:00Z'),
          fim: new Date('2026-10-31T00:00:00Z'),
          produtos: [],
        },
      ],
    });

    const res = await getSazonalidade();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      hoje: '2026-11-20',
      horizonteDias: 90,
      simulado: true,
      limiteEstoqueBaixo: LIMITE_ESTOQUE_BAIXO,
      clientesDaCarteira: 4,
      clientesConsultados: 3,
      clientesComEstoque: 2,
      estoqueIndisponivel: false,
      clientesIndisponiveis: { vendas: 0, estoque: 0 },
      datas: [
        {
          id: expect.any(String),
          nome: 'Natal 2026',
          chave: 'NATAL',
          data: '2026-12-25',
          diasAte: 35,
          janela: { inicio: '2026-11-25', fim: '2026-12-25' },
          janelaAnoAnterior: { inicio: '2025-11-25', fim: '2025-12-25' },
          vendasAnoAnterior: 5200.5,
          vendasNaJanelaAtual: null,
          campanhas: [
            {
              id: expect.any(String),
              nome: 'Promoção de Natal',
              tipo: 'PROMOCAO',
              inicio: '2026-12-01',
              fim: '2026-12-24',
              desconto: 12,
              situacao: 'PROGRAMADA',
            },
          ],
          clientesComEstoqueBaixo: 2,
          estoqueBaixo: [
            {
              sku: 'CX-PRESENTE',
              nome: 'Caixa presente sortida',
              totalClientes: 2,
              clientes: [
                { id: clienteA1, nomeFantasia: 'Emporio Pomerode', cidade: 'Pomerode', quantidade: 3 },
                { id: clienteB1, nomeFantasia: 'Bombons Indaial', cidade: 'Indaial', quantidade: 8 },
              ],
            },
            {
              sku: 'BOMB-SORT',
              nome: expect.any(String),
              totalClientes: 1,
              clientes: [{ id: clienteB1, nomeFantasia: 'Bombons Indaial', cidade: 'Indaial', quantidade: 5 }],
            },
          ],
        },
      ],
    });
  });

  it('consulta o ERP uma vez por cliente, num período que cobre todas as janelas até hoje', async () => {
    const res = await getSazonalidade({ horizonteDias: '180' });

    expect(res.status).toBe(200);
    expect(getSales).toHaveBeenCalledTimes(3);
    expect(getStockHistory).toHaveBeenCalledTimes(3);
    for (const [, periodo] of getSales.mock.calls) {
      // A janela mais antiga é a do Natal de 2025; a Páscoa de 2026 já está dentro.
      expect(periodo.inicio).toEqual(new Date('2025-11-25T00:00:00.000-03:00'));
      expect(periodo.fim).toEqual(new Date('2026-11-20T23:59:59.999-03:00'));
    }
  });

  it('a data fora do horizonte fica de fora; com 180 dias entra, em ordem de proximidade', async () => {
    const [com90, com180] = await Promise.all([getSazonalidade(), getSazonalidade({ horizonteDias: '180' })]);

    expect(com90.body.datas.map(({ nome }: { nome: string }) => nome)).toEqual(['Natal 2026']);
    expect(com180.body.datas.map(({ nome }: { nome: string }) => nome)).toEqual(['Natal 2026', 'Páscoa 2027']);

    const pascoa = com180.body.datas[1];
    expect(pascoa.diasAte).toBe(128);
    expect(pascoa.janela).toEqual({ inicio: '2027-02-26', fim: '2027-03-28' });
    expect(pascoa.janelaAnoAnterior).toEqual({ inicio: '2026-03-06', fim: '2026-04-05' });
    expect(pascoa.vendasAnoAnterior).toBe(700);
    expect(pascoa.vendasNaJanelaAtual).toBeNull();
    // Um produto indicado para as duas datas aparece nas duas.
    expect(pascoa.estoqueBaixo.map(({ sku, totalClientes }: { sku: string; totalClientes: number }) => [sku, totalClientes])).toEqual([
      ['CX-PRESENTE', 2],
      ['TRUF-70', 1],
      ['OVO-PASCOA', 0],
    ]);
    expect(pascoa.clientesComEstoqueBaixo).toBe(2);
  });

  it('com a janela deste ano começada, soma as vendas do início dela até hoje', async () => {
    fixarRelogio(new Date('2026-12-10T15:00:00.000Z'));
    // O token do beforeEach vence com o relógio 20 dias à frente.
    const token = await logar('ricardo.sazonal-teste');

    const res = await getSazonalidade({}, token);

    expect(res.status).toBe(200);
    const [natal] = res.body.datas;
    expect(natal.diasAte).toBe(15);
    // 05/12 de ERP-1001 (300) e 30/11 de ERP-1003 (50); 19/11 fica antes da janela.
    expect(natal.vendasNaJanelaAtual).toBe(350);
    expect(natal.vendasAnoAnterior).toBe(5200.5);
  });

  it('sem data no horizonte devolve a lista vazia sem consultar o ERP', async () => {
    const res = await getSazonalidade({ horizonteDias: '30' });

    expect(res.status).toBe(200);
    expect(res.body.datas).toEqual([]);
    expect(getSales).not.toHaveBeenCalled();
    expect(getStockHistory).not.toHaveBeenCalled();
  });

  it('o gestor com representanteId vê só aquela carteira', async () => {
    const res = await getSazonalidade({ representanteId: repBId });

    expect(res.status).toBe(200);
    expect(res.body.clientesDaCarteira).toBe(1);
    expect(res.body.clientesComEstoque).toBe(1);
    expect(res.body.datas[0].vendasAnoAnterior).toBe(4000);
    expect(res.body.datas[0].estoqueBaixo[0].clientes.map(({ id }: { id: string }) => id)).toEqual([clienteB1]);
  });

  it('o representante vê só a própria carteira, mesmo mandando o representanteId de outro', async () => {
    const res = await getSazonalidade({ representanteId: repBId }, tokenA);

    expect(res.status).toBe(200);
    expect(res.body.clientesDaCarteira).toBe(3);
    expect(res.body.clientesConsultados).toBe(2);
    expect(res.body.clientesComEstoque).toBe(1);
    expect(res.body.datas[0].vendasAnoAnterior).toBe(1200.5);
    expect(res.body.datas[0].estoqueBaixo).toEqual([
      expect.objectContaining({ sku: 'CX-PRESENTE', totalClientes: 1 }),
      expect.objectContaining({ sku: 'BOMB-SORT', totalClientes: 0, clientes: [] }),
    ]);
  });

  it('no provedor de produção, o cliente com nota importada é consultado, soma nas vendas e fica fora de clientesComEstoque', async () => {
    // O provedor híbrido devolve histórico de estoque vazio para o cliente com nota do CNPJ (fonte `notas`).
    getStockHistory.mockImplementation(async (chave) => (chave === 'ERP-1003' ? [] : (ESTOQUE[chave] ?? [])));

    const res = await getSazonalidade();

    expect(res.status).toBe(200);
    expect(getStockHistory).toHaveBeenCalledWith('ERP-1003');
    expect(res.body.clientesConsultados).toBe(3);
    expect(res.body.clientesComEstoque).toBe(1);
    expect(res.body.clientesIndisponiveis).toEqual({ vendas: 0, estoque: 0 });
    expect(res.body.datas[0].vendasAnoAnterior).toBe(5200.5);
    expect(res.body.datas[0].estoqueBaixo[0]).toEqual(
      expect.objectContaining({ sku: 'CX-PRESENTE', totalClientes: 1, clientes: [expect.objectContaining({ id: clienteA1 })] }),
    );
  });

  it('o cliente que o ERP não respondeu fica fora das somas e é contado em clientesIndisponiveis', async () => {
    getSales.mockImplementation(async (chave, periodo) => {
      if (chave === 'ERP-1003') throw new ErpIndisponivelError();
      return (VENDAS[chave] ?? []).filter(({ data }) => data >= periodo.inicio && data <= periodo.fim);
    });
    getStockHistory.mockImplementation(async (chave) => {
      if (chave === 'ERP-1001') throw new ErpIndisponivelError();
      return ESTOQUE[chave] ?? [];
    });

    const res = await getSazonalidade();

    expect(res.status).toBe(200);
    expect(res.body.clientesIndisponiveis).toEqual({ vendas: 1, estoque: 1 });
    expect(res.body.clientesComEstoque).toBe(1);
    expect(res.body.datas[0].vendasAnoAnterior).toBe(1200.5);
    expect(res.body.datas[0].estoqueBaixo[0].clientes.map(({ id }: { id: string }) => id)).toEqual([clienteB1]);
  });
});

type PontoMensal = { mes: string; total: number | null; clientesComDados: number | null; futuro: boolean };

describe('GET /dashboard/vendas-mensais com ateProximaData', () => {
  it('sem a opção, a série termina no mês de hoje e nenhum mês é futuro', async () => {
    const res = await getVendasMensais();

    expect(res.status).toBe(200);
    expect(res.body.meses.map(({ mes }: PontoMensal) => mes)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(res.body.meses.every(({ futuro }: PontoMensal) => futuro === false)).toBe(true);
    expect(res.body.proximaData).toBeNull();
  });

  it('com a opção, vai até o mês da próxima data do horizonte, com os meses futuros sem valor', async () => {
    const res = await getVendasMensais({ ateProximaData: 'true', horizonteDias: '180' });

    expect(res.status).toBe(200);
    const meses: PontoMensal[] = res.body.meses;
    expect(meses.map(({ mes }) => mes)).toEqual(['2026-09', '2026-10', '2026-11', '2026-12']);
    expect(meses.map(({ futuro }) => futuro)).toEqual([false, false, false, true]);
    expect(meses[3]).toEqual({ mes: '2026-12', total: null, clientesComDados: null, clientes: [], futuro: true });
    // 19/11 de ERP-1001 (80); 30/11 e 05/12 ainda não aconteceram e o ERP é consultado só até hoje.
    expect(meses[2]!.total).toBe(80);
    expect(res.body.proximaData).toEqual({ id: expect.any(String), nome: 'Natal 2026', chave: 'NATAL', data: '2026-12-25' });
    expect(res.body.eventos).toContainEqual({ chave: 'NATAL', nome: 'Natal', data: '2026-12-25' });
    for (const [, periodo] of getSales.mock.calls) {
      expect(periodo.fim).toEqual(new Date('2026-11-20T23:59:59.999-03:00'));
    }
  });

  it('com um período personalizado no passado, a opção é ignorada e a série fica nos meses pedidos', async () => {
    const res = await getVendasMensais({ ateProximaData: 'true', inicio: '2026-06-01', fim: '2026-08-31' });

    expect(res.status).toBe(200);
    expect(res.body.meses.map(({ mes }: PontoMensal) => mes)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(res.body.meses.every(({ futuro }: PontoMensal) => futuro === false)).toBe(true);
    expect(res.body.proximaData).toBeNull();
    for (const [, periodo] of getSales.mock.calls) {
      expect(periodo.fim).toEqual(new Date('2026-08-31T23:59:59.999-03:00'));
    }
  });

  it('sem data no horizonte, a opção não estende a série', async () => {
    const res = await getVendasMensais({ ateProximaData: 'true', horizonteDias: '30' });

    expect(res.status).toBe(200);
    expect(res.body.meses.map(({ mes }: PontoMensal) => mes)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(res.body.proximaData).toBeNull();
  });

  it('o horizonte padrão é de 90 dias', async () => {
    const res = await getVendasMensais({ ateProximaData: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.meses.at(-1)).toEqual(expect.objectContaining({ mes: '2026-12', futuro: true }));
  });

  it.each<[Record<string, string>, string]>([
    [{ ateProximaData: 'sim' }, 'opção que não é true nem false'],
    [{ ateProximaData: 'true', horizonteDias: '400' }, 'horizonte acima do máximo'],
  ])('%o (%s) responde 400 VALIDATION_ERROR', async (query) => {
    const res = await getVendasMensais(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
