import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { ResultadoVisita } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ErpIndisponivelError } from '../src/providers/erp/ErpProvider';
import { perfilDoErpId } from '../src/providers/erp/mock/gerador';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.clients-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.clients-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let representanteId: string;
let gestorId: string;

type ClienteFixture = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  ativo?: boolean;
  erpId?: string;
  contatos: {
    nome: string;
    cargo: string;
    telefone: string;
    email: string;
    principal: boolean;
  }[];
};

const CLIENTE_POMERODE: ClienteFixture = {
  razaoSocial: 'Empório Pomerode Comércio de Alimentos Ltda',
  nomeFantasia: 'Empório Pomerode',
  cnpj: '11222333000181',
  cidade: 'Pomerode',
  endereco: 'Rua Hermann Weege, 620 - Centro, Pomerode/SC',
  telefone: '(47) 3395-1122',
  email: 'contato@emporiopomerode.com.br',
  contatos: [
    {
      nome: 'Marta Weber',
      cargo: 'Compradora',
      telefone: '(47) 99911-2233',
      email: 'marta.weber@emporiopomerode.com.br',
      principal: true,
    },
    {
      nome: 'João Siewert',
      cargo: 'Proprietário',
      telefone: '(47) 99922-3344',
      email: 'joao.siewert@emporiopomerode.com.br',
      principal: false,
    },
  ],
};

const CLIENTE_BLUMENAU: ClienteFixture = {
  razaoSocial: 'Café Blumenau Comércio de Alimentos Ltda',
  nomeFantasia: 'Café Blumenau',
  cnpj: '11222333000262',
  cidade: 'Blumenau',
  endereco: 'Rua XV de Novembro, 500 - Centro, Blumenau/SC',
  telefone: '(47) 3322-1010',
  email: 'contato@cafeblumenau.com.br',
  contatos: [
    {
      nome: 'Helena Krüger',
      cargo: 'Gerente',
      telefone: '(47) 99933-1010',
      email: 'helena.kruger@cafeblumenau.com.br',
      principal: true,
    },
  ],
};

const CLIENTE_INATIVO: ClienteFixture = {
  razaoSocial: 'Doceria Jaraguá Doces e Salgados Ltda',
  nomeFantasia: 'Doceria Jaraguá',
  cnpj: '11222333000343',
  cidade: 'Jaraguá do Sul',
  endereco: 'Rua Reinoldo Rau, 220 - Centro, Jaraguá do Sul/SC',
  telefone: '(47) 3275-2020',
  email: 'contato@doceriajaragua.com.br',
  ativo: false,
  contatos: [
    {
      nome: 'Cristiane Bauer',
      cargo: 'Proprietária',
      telefone: '(47) 99944-2020',
      email: 'cristiane.bauer@doceriajaragua.com.br',
      principal: true,
    },
  ],
};

/** Procura, entre ERP-1001 e ERP-1300, um erpId cujo perfil tenha `mesesSemCompra >= minMeses`. */
function encontrarErpIdComMesesSemCompra(minMeses: number): string {
  for (let i = 1001; i <= 1300; i++) {
    const erpId = `ERP-${i}`;
    if (perfilDoErpId(erpId).mesesSemCompra >= minMeses) {
      return erpId;
    }
  }

  throw new Error(`Nenhum erpId em ERP-1001..ERP-1300 com mesesSemCompra >= ${minMeses}.`);
}

/** Procura, entre ERP-1001 e ERP-1300, um erpId cujo perfil tenha `mesesSemCompra === meses`. */
function encontrarErpIdComMesesSemCompraExato(meses: number): string {
  for (let i = 1001; i <= 1300; i++) {
    const erpId = `ERP-${i}`;
    if (perfilDoErpId(erpId).mesesSemCompra === meses) {
      return erpId;
    }
  }

  throw new Error(`Nenhum erpId em ERP-1001..ERP-1300 com mesesSemCompra === ${meses}.`);
}

async function idDoClientePorNomeFantasia(nomeFantasia: string): Promise<string> {
  const cliente = await prisma.client.findFirstOrThrow({ where: { nomeFantasia } });
  return cliente.id;
}

async function criarClienteFixture(fixture: ClienteFixture, donoId: string): Promise<string> {
  const { contatos, ativo, ...dadosCliente } = fixture;
  const client = await prisma.client.create({
    data: {
      ...dadosCliente,
      ...(ativo !== undefined ? { ativo } : {}),
      representanteId: donoId,
      contacts: { create: contatos },
    },
  });
  return client.id;
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarVisita(clienteId: string, diasAtras: number, resultado: ResultadoVisita) {
  return prisma.visit.create({
    data: {
      clientId: clienteId,
      userId: representanteId,
      dataHora: new Date(Date.now() - diasAtras * 86_400_000),
      descricao: 'Visita de teste',
      resultado,
    },
  });
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  const gestor = await prisma.user.create({ data: { ...GESTOR, senhaHash } });
  gestorId = gestor.id;

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  await criarClienteFixture(CLIENTE_POMERODE, representanteId);
  await criarClienteFixture(CLIENTE_BLUMENAU, representanteId);
  await criarClienteFixture(CLIENTE_INATIVO, representanteId);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

function payloadClienteNovo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    razaoSocial: 'Mercado Central Joinville Comércio de Alimentos Ltda',
    nomeFantasia: 'Mercado Central Joinville',
    cnpj: '11222333000424',
    cidade: 'Joinville',
    endereco: 'Rua do Príncipe, 800 - Centro, Joinville/SC',
    telefone: '(47) 3433-3030',
    email: 'contato@mercadocentraljoinville.com.br',
    contatos: [
      {
        nome: 'Roberto Alves',
        cargo: 'Gerente de Compras',
        telefone: '(47) 99955-3030',
        email: 'roberto.alves@mercadocentraljoinville.com.br',
        principal: true,
      },
    ],
    ...overrides,
  };
}

describe('GET /clients', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/clients');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('lista clientes ativos por padrão, no formato do contrato', async () => {
    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);

    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode).toEqual({
      id: expect.any(String),
      nomeFantasia: 'Empório Pomerode',
      razaoSocial: CLIENTE_POMERODE.razaoSocial,
      cidade: 'Pomerode',
      telefone: CLIENTE_POMERODE.telefone,
      ativo: true,
      contatoPrincipal: { nome: 'Marta Weber', telefone: '(47) 99911-2233' },
      cor: 'VERMELHO',
      diasSemVisita: null,
      rebaixadoPorVenda: false,
      representante: { id: representanteId, nome: REPRESENTANTE.nome },
    });

    const inativo = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Doceria Jaraguá');
    expect(inativo).toBeUndefined();
  });

  it('search "pomerode" (case-insensitive) encontra exatamente 1 cliente', async () => {
    const res = await request(app)
      .get('/clients')
      .query({ search: 'pomerode' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nomeFantasia).toBe('Empório Pomerode');
  });

  it('ativo=todos inclui clientes inativos na listagem', async () => {
    const res = await request(app)
      .get('/clients')
      .query({ ativo: 'todos' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.some((c: { nomeFantasia: string }) => c.nomeFantasia === 'Doceria Jaraguá')).toBe(true);
  });

  it('GET /clients traz cor VERMELHO, diasSemVisita null e representante para cliente sem visita', async () => {
    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('VERMELHO');
    expect(pomerode.diasSemVisita).toBeNull();
    expect(pomerode.representante).toEqual({ id: representanteId, nome: REPRESENTANTE.nome });
  });

  it('GET /clients calcula VERDE para visita de 3 dias com VENDA', async () => {
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('VERDE');
    expect(pomerode.diasSemVisita).toBe(3);
  });

  it('cor usa a visita mais recente por dataHora, não a última gravada', async () => {
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await criarVisita(id, 3, 'VENDA');
    await criarVisita(id, 40, 'SEM_VENDA');

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('VERDE');
    expect(pomerode.diasSemVisita).toBe(3);
  });

  it('GET /clients?color=VERMELHO devolve só os vermelhos', async () => {
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app)
      .get('/clients')
      .query({ color: 'VERMELHO' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((c: { cor: string }) => c.cor === 'VERMELHO')).toBe(true);
    expect(res.body.data.some((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode')).toBe(false);
  });

  it('GET /clients?color=roxo responde 400', async () => {
    const res = await request(app).get('/clients').query({ color: 'roxo' }).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lista: cliente VERDE por visita mas sem compra há mais de 60 dias vem LARANJA com rebaixadoPorVenda true', async () => {
    const erpId = encontrarErpIdComMesesSemCompra(3);
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await prisma.client.update({ where: { id }, data: { erpId } });
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('LARANJA');
    expect(pomerode.rebaixadoPorVenda).toBe(true);
  });

  it('lista: cliente com compra recente mantém VERDE e rebaixadoPorVenda false', async () => {
    const erpId = encontrarErpIdComMesesSemCompraExato(0);
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await prisma.client.update({ where: { id }, data: { erpId } });
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('VERDE');
    expect(pomerode.rebaixadoPorVenda).toBe(false);
  });

  it('lista: erpId desconhecido (-0) mantém a cor base', async () => {
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await prisma.client.update({ where: { id }, data: { erpId: 'ERP-9999-0' } });
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('VERDE');
    expect(pomerode.rebaixadoPorVenda).toBe(false);
  });

  it('lista: provider indisponível responde 200 com cor base', async () => {
    jest.spyOn(erpProvider, 'getLastSale').mockRejectedValue(new ErpIndisponivelError());
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await prisma.client.update({ where: { id }, data: { erpId: 'ERP-1001' } });
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const pomerode = res.body.data.find((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode');
    expect(pomerode.cor).toBe('VERDE');
    expect(pomerode.rebaixadoPorVenda).toBe(false);
  });

  it('?color=LARANJA inclui o cliente rebaixado', async () => {
    const erpId = encontrarErpIdComMesesSemCompra(3);
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await prisma.client.update({ where: { id }, data: { erpId } });
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app)
      .get('/clients')
      .query({ color: 'LARANJA' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { nomeFantasia: string }) => c.nomeFantasia === 'Empório Pomerode')).toBe(true);
  });
});

describe('POST /clients', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).post('/clients').send(payloadClienteNovo());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cria cliente com contato principal e responde 201 com o cliente completo', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadClienteNovo());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      razaoSocial: 'Mercado Central Joinville Comércio de Alimentos Ltda',
      nomeFantasia: 'Mercado Central Joinville',
      cnpj: '11222333000424',
      cidade: 'Joinville',
      endereco: 'Rua do Príncipe, 800 - Centro, Joinville/SC',
      telefone: '(47) 3433-3030',
      email: 'contato@mercadocentraljoinville.com.br',
      erpId: null,
      recorrenciaDias: 15,
      ativo: true,
      criadoEm: expect.any(String),
      contatos: [
        {
          id: expect.any(String),
          nome: 'Roberto Alves',
          cargo: 'Gerente de Compras',
          telefone: '(47) 99955-3030',
          email: 'roberto.alves@mercadocentraljoinville.com.br',
          principal: true,
        },
      ],
      cor: 'VERMELHO',
      diasSemVisita: null,
      rebaixadoPorVenda: false,
      diasSemCompra: null,
      representante: { id: representanteId, nome: REPRESENTANTE.nome },
      recorrenciaChanges: [],
    });

    const persistido = await prisma.client.findUnique({ where: { id: res.body.id } });
    expect(persistido).not.toBeNull();
  });

  it('grava o representante logado como dono da carteira', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadClienteNovo());

    expect(res.status).toBe(201);

    const salvo = await prisma.client.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(salvo.representanteId).toBe(representanteId);
  });

  it('por gestor responde 400', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send(payloadClienteNovo());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sem nenhum contato marcado como principal responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(
        payloadClienteNovo({
          contatos: [
            {
              nome: 'Roberto Alves',
              cargo: 'Gerente de Compras',
              telefone: '(47) 99955-3030',
              email: 'roberto.alves@mercadocentraljoinville.com.br',
              principal: false,
            },
          ],
        }),
      );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('com dois contatos marcados como principal responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(
        payloadClienteNovo({
          contatos: [
            {
              nome: 'Roberto Alves',
              cargo: 'Gerente de Compras',
              telefone: '(47) 99955-3030',
              email: 'roberto.alves@mercadocentraljoinville.com.br',
              principal: true,
            },
            {
              nome: 'Ana Paula',
              cargo: 'Compradora',
              telefone: '(47) 99900-1111',
              email: 'ana.paula@mercadocentraljoinville.com.br',
              principal: true,
            },
          ],
        }),
      );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sem nenhum contato informado responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadClienteNovo({ contatos: [] }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cnpj repetido responde 409 CONFLICT', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadClienteNovo({ cnpj: CLIENTE_POMERODE.cnpj }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('recorrenciaDias fora do intervalo 1-365 responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadClienteNovo({ recorrenciaDias: 400 }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /clients/:id', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get(`/clients/${ID_INEXISTENTE}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cliente inexistente responde 404', async () => {
    const res = await request(app).get(`/clients/${ID_INEXISTENTE}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('cliente existente responde 200 com contatos ordenados (principal primeiro)', async () => {
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');

    const res = await request(app).get(`/clients/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.contatos).toHaveLength(2);
    expect(res.body.contatos[0]).toMatchObject({ nome: 'Marta Weber', principal: true });
    expect(res.body.contatos[1]).toMatchObject({ nome: 'João Siewert', principal: false });
  });

  it('GET /clients/:id traz cor, diasSemVisita, representante e recorrenciaChanges vazio', async () => {
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get(`/clients/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cor).toBe('VERDE');
    expect(res.body.diasSemVisita).toBe(3);
    expect(res.body.representante).toEqual({ id: representanteId, nome: REPRESENTANTE.nome });
    expect(res.body.recorrenciaChanges).toEqual([]);
  });

  it('ficha traz rebaixadoPorVenda e diasSemCompra', async () => {
    const erpId = encontrarErpIdComMesesSemCompra(3);
    const id = await idDoClientePorNomeFantasia('Empório Pomerode');
    await prisma.client.update({ where: { id }, data: { erpId } });
    await criarVisita(id, 3, 'VENDA');

    const res = await request(app).get(`/clients/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.cor).toBe('LARANJA');
    expect(res.body.rebaixadoPorVenda).toBe(true);
    expect(typeof res.body.diasSemCompra).toBe('number');
    expect(res.body.diasSemCompra).toBeGreaterThan(60);
  });
});

describe('PUT /clients/:id', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).put(`/clients/${ID_INEXISTENTE}`).send({ telefone: '(47) 0000-0000' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cliente inexistente responde 404', async () => {
    const res = await request(app)
      .put(`/clients/${ID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefone: '(47) 0000-0000' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('atualiza campos parciais do cliente', async () => {
    const id = await idDoClientePorNomeFantasia('Café Blumenau');

    const res = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefone: '(47) 9999-8888', cidade: 'Gaspar' });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBe('(47) 9999-8888');
    expect(res.body.cidade).toBe('Gaspar');
  });

  it('ativo: false inativa o cliente (some da listagem default, aparece em ativo=todos)', async () => {
    const id = await idDoClientePorNomeFantasia('Café Blumenau');

    const put = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ativo: false });

    expect(put.status).toBe(200);
    expect(put.body.ativo).toBe(false);

    const listaDefault = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);
    expect(listaDefault.body.data.some((c: { id: string }) => c.id === id)).toBe(false);

    const listaTodos = await request(app)
      .get('/clients')
      .query({ ativo: 'todos' })
      .set('Authorization', `Bearer ${token}`);
    expect(listaTodos.body.data.some((c: { id: string }) => c.id === id)).toBe(true);
  });

  it('com recorrenciaDias responde 400', async () => {
    const id = await idDoClientePorNomeFantasia('Café Blumenau');

    const res = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorrenciaDias: 20 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('com representanteId por representante responde 403', async () => {
    const id = await idDoClientePorNomeFantasia('Café Blumenau');

    const res = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ representanteId });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('com representanteId por gestor transfere a carteira', async () => {
    const id = await idDoClientePorNomeFantasia('Café Blumenau');
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const outroRepresentante = await prisma.user.create({
      data: {
        nome: 'Outro Representante',
        email: 'outro.clients-teste@chokolaten.com.br',
        role: 'REPRESENTANTE',
        senhaHash,
      },
    });

    const res = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ representanteId: outroRepresentante.id });

    expect(res.status).toBe(200);

    const salvo = await prisma.client.findUniqueOrThrow({ where: { id } });
    expect(salvo.representanteId).toBe(outroRepresentante.id);
  });

  it('com representanteId de gestor ou inexistente responde 400', async () => {
    const id = await idDoClientePorNomeFantasia('Café Blumenau');

    const resDeGestor = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ representanteId: gestorId });

    expect(resDeGestor.status).toBe(400);
    expect(resDeGestor.body.error.code).toBe('VALIDATION_ERROR');

    const resInexistente = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ representanteId: ID_INEXISTENTE });

    expect(resInexistente.status).toBe(400);
    expect(resInexistente.body.error.code).toBe('VALIDATION_ERROR');
  });
});
