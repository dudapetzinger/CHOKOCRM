import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { HORIZONTE_PADRAO_DIAS, SKUS_SUGERIDOS } from '../src/config/sazonalidade';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ErpIndisponivelError } from '../src/providers/erp/ErpProvider';
import * as seasonalEventRepository from '../src/repositories/seasonal-event.repository';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';
const LIMITE_ESTOQUE_BAIXO = 10;

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.insights-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.insights-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let representanteId: string;
let clienteComErpId: string;
let clienteSemErpId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarCliente(
  cnpj: string,
  nomeFantasia: string,
  opcoes: { erpId: string | null; ativo: boolean },
): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${apelido(nomeFantasia)}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId: opcoes.erpId,
      ativo: opcoes.ativo,
    },
  });
  return cliente.id;
}

/** Insere um Natal cujo dia do evento (`dataFim`) cai daqui a `diasAteEvento` dias, ao meio-dia UTC. */
async function criarNatalEmDias(diasAteEvento: number, nome = 'Natal teste'): Promise<void> {
  const dataFim = new Date();
  dataFim.setUTCDate(dataFim.getUTCDate() + diasAteEvento);
  dataFim.setUTCHours(12, 0, 0, 0);

  const dataInicio = new Date(dataFim);
  dataInicio.setUTCDate(dataInicio.getUTCDate() - 30);

  await seasonalEventRepository.upsertMany([
    {
      nome,
      chave: 'NATAL',
      dataInicio,
      dataFim,
      produtosSugeridos: ['caixas presente', 'bombons sortidos'],
    },
  ]);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  clienteComErpId = await criarCliente('11222333000181', 'Emporio Pomerode', { erpId: 'ERP-1001', ativo: true });
  clienteSemErpId = await criarCliente('11222333000262', 'Padaria Vale Europeu', { erpId: null, ativo: true });
  await criarCliente('11222333000343', 'Armazem Sao Bento', { erpId: 'ERP-1002', ativo: false });
  await criarCliente('11222333000424', 'Emporio do Chocolate', { erpId: 'ERP-1000-0', ativo: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /clients/:id/insights', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get(`/clients/${clienteComErpId}/insights`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cliente inexistente responde 404', async () => {
    const res = await request(app)
      .get(`/clients/${ID_INEXISTENTE}/insights`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['horizonteDias=10', 'abaixo do mínimo'],
    ['horizonteDias=400', 'acima do máximo'],
    ['horizonteDias=abc', 'não numérico'],
  ])('%s (%s) responde 400 VALIDATION_ERROR', async (consulta) => {
    const res = await request(app)
      .get(`/clients/${clienteComErpId}/insights?${consulta}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cliente sem erpId responde 200 SEM_ERP_ID', async () => {
    const res = await request(app)
      .get(`/clients/${clienteSemErpId}/insights`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'SEM_ERP_ID' });
  });

  it('com um Natal no horizonte responde 200 OK com horizonteDias 90 e o evento em sugestoes ou eventosSemHistorico', async () => {
    await criarNatalEmDias(40);

    const res = await request(app)
      .get(`/clients/${clienteComErpId}/insights`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.simulado).toBe(true);
    expect(res.body.horizonteDias).toBe(HORIZONTE_PADRAO_DIAS);
    expect(res.body.sugestoes.length + res.body.eventosSemHistorico.length).toBe(1);
  });

  it('o gestor também recebe 200', async () => {
    await criarNatalEmDias(40);

    const res = await request(app)
      .get(`/clients/${clienteComErpId}/insights`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('provedor de ERP indisponível ao consultar vendas responde 200 INDISPONIVEL', async () => {
    await criarNatalEmDias(40);
    jest.spyOn(erpProvider, 'getSales').mockRejectedValueOnce(new ErpIndisponivelError());

    const res = await request(app)
      .get(`/clients/${clienteComErpId}/insights`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'INDISPONIVEL' });
  });
});

describe('GET /insights/manager-alerts', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/insights/manager-alerts');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante responde 403', async () => {
    const res = await request(app).get('/insights/manager-alerts').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('gestor recebe 200 com o evento do horizonte, 2 clientes consultados e alertas só de SKUs do evento com estoque baixo', async () => {
    await criarNatalEmDias(40);

    const res = await request(app).get('/insights/manager-alerts').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.simulado).toBe(true);
    expect(res.body.horizonteDias).toBe(HORIZONTE_PADRAO_DIAS);
    expect(res.body.eventos).toHaveLength(1);
    expect(res.body.eventos[0].nome).toBe('Natal teste');
    expect(res.body.eventos[0].produtosSugeridos).toEqual(['caixas presente', 'bombons sortidos']);
    // ERP-1001 e ERP-1000-0: o cliente inativo e o sem erpId ficam de fora.
    expect(res.body.clientesConsultados).toBe(2);
    expect(res.body.clientesIndisponiveis).toBe(0);

    for (const alerta of res.body.alertas) {
      expect(SKUS_SUGERIDOS.NATAL).toContain(alerta.produto.sku);
      expect(alerta.clientes.length).toBeGreaterThan(0);
      for (const cliente of alerta.clientes) {
        expect(cliente.quantidade).toBeLessThan(LIMITE_ESTOQUE_BAIXO);
      }
    }
  });

  it('horizonteDias ausente vale 90 e =180 amplia o horizonte', async () => {
    await criarNatalEmDias(120);

    const padrao = await request(app).get('/insights/manager-alerts').set('Authorization', `Bearer ${tokenGestor}`);

    expect(padrao.status).toBe(200);
    expect(padrao.body.horizonteDias).toBe(90);
    expect(padrao.body.eventos).toHaveLength(0);

    const ampliado = await request(app)
      .get('/insights/manager-alerts?horizonteDias=180')
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(ampliado.status).toBe(200);
    expect(ampliado.body.horizonteDias).toBe(180);
    expect(ampliado.body.eventos).toHaveLength(1);
  });

  it('horizonteDias fora do intervalo responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/insights/manager-alerts?horizonteDias=10')
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('provedor de ERP indisponível ao consultar estoque responde 200 com clientesIndisponiveis e sem alertas', async () => {
    await criarNatalEmDias(40);
    jest.spyOn(erpProvider, 'getStockHistory').mockRejectedValue(new ErpIndisponivelError());

    const res = await request(app).get('/insights/manager-alerts').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.clientesConsultados).toBe(2);
    expect(res.body.clientesIndisponiveis).toBeGreaterThan(0);
    expect(res.body.alertas).toEqual([]);
  });
});

/** Segundo representante, dono só de um cliente ativo com `erpId`. */
async function criarCarteiraB(): Promise<{ representanteBId: string; clienteDeBId: string; tokenB: string }> {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representanteB = await prisma.user.create({
    data: { nome: 'Bruno Alencar', email: 'bruno.insights-teste@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
  });
  const clienteDeB = await prisma.client.create({
    data: {
      razaoSocial: 'Bombons Indaial Comércio Ltda',
      nomeFantasia: 'Bombons Indaial',
      cnpj: '11222333000505',
      cidade: 'Indaial',
      endereco: 'Rua Tiradentes, 10',
      telefone: '(47) 3333-0000',
      email: 'contato@bombonsindaial.com.br',
      recorrenciaDias: 15,
      representanteId: representanteB.id,
      erpId: 'ERP-1003',
    },
  });

  return {
    representanteBId: representanteB.id,
    clienteDeBId: clienteDeB.id,
    tokenB: await logar('bruno.insights-teste@chokolaten.com.br'),
  };
}

describe('GET /clients/:id/insights na regra de carteira', () => {
  it('representante recebe 404 nos insights de cliente de outra carteira', async () => {
    const { clienteDeBId } = await criarCarteiraB();

    const res = await request(app).get(`/clients/${clienteDeBId}/insights`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Cliente não encontrado.');
  });
});

describe('GET /insights/manager-alerts com representanteId', () => {
  it('gestor com ?representanteId=<B> recebe alertas só dos clientes de B', async () => {
    await criarNatalEmDias(40);
    const { representanteBId, clienteDeBId } = await criarCarteiraB();

    const res = await request(app)
      .get('/insights/manager-alerts')
      .query({ representanteId: representanteBId })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.clientesConsultados).toBe(1);
    for (const alerta of res.body.alertas) {
      for (const cliente of alerta.clientes) {
        expect(cliente.id).toBe(clienteDeBId);
      }
    }
  });

  it('gestor com representanteId de usuário inexistente recebe zero clientes e nenhum alerta', async () => {
    await criarNatalEmDias(40);

    const res = await request(app)
      .get('/insights/manager-alerts')
      .query({ representanteId: randomUUID() })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.eventos).toHaveLength(1);
    expect(res.body.clientesConsultados).toBe(0);
    expect(res.body.alertas).toEqual([]);
  });

  it('representante continua recebendo 403, mesmo com representanteId', async () => {
    const res = await request(app)
      .get('/insights/manager-alerts')
      .query({ representanteId })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('representanteId que não é uuid responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/insights/manager-alerts')
      .query({ representanteId: 'abc' })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
