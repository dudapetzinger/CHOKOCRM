import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.kpis-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.kpis-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

type Resultado = 'VENDA' | 'SEM_VENDA' | 'NEGOCIACAO';

let token: string;
let tokenGestor: string;
let representanteId: string;
let clienteAId: string;
let clienteBId: string;
let clienteCId: string;
let clienteDId: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

/** Instante `diasAtras` dias antes de hoje, em horário de meio de dia (longe da virada do dia). */
function haDias(diasAtras: number): Date {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() - diasAtras);
  data.setUTCHours(15, 0, 0, 0);
  return data;
}

async function criarCliente(cnpj: string, nomeFantasia: string, ativo: boolean): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${nomeFantasia.toLowerCase().replace(/\s/g, '')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId: null,
      ativo,
    },
  });
  return cliente.id;
}

async function criarVisita(clientId: string, diasAtras: number, resultado: Resultado): Promise<void> {
  await prisma.visit.create({
    data: {
      clientId,
      userId: representanteId,
      dataHora: haDias(diasAtras),
      descricao: 'Visita de teste.',
      resultado,
    },
  });
}

async function criarClientes(): Promise<void> {
  clienteAId = await criarCliente('11222333000181', 'Emporio Pomerode', true);
  clienteBId = await criarCliente('11222333000262', 'Padaria Vale Europeu', true);
  clienteCId = await criarCliente('11222333000424', 'Emporio do Chocolate', true);
  clienteDId = await criarCliente('11222333000343', 'Armazem Sao Bento', false);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  await criarClientes();

  await criarVisita(clienteAId, 2, 'VENDA');
  await criarVisita(clienteAId, 10, 'SEM_VENDA');
  await criarVisita(clienteBId, 40, 'NEGOCIACAO');
  await criarVisita(clienteDId, 3, 'VENDA');
  await criarVisita(clienteAId, 100, 'VENDA');

  await prisma.stockMessage.create({
    data: {
      clientId: clienteCId,
      userId: representanteId,
      textoFinal: 'Mensagem de estoque de teste.',
      dataGeracao: haDias(5),
      eventoSazonalId: null,
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /dashboard/kpis', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/dashboard/kpis');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante responde 403', async () => {
    const res = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it.each(['60', 'abc'])('periodoDias=%s responde 400 VALIDATION_ERROR', async (periodoDias) => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gestor recebe os indicadores dos últimos 30 dias', async () => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias: 30 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.periodo.dias).toBe(30);
    expect(res.body.clientesAtivos).toBe(3);
    // A (−2 e −10) e D (inativo, −3); B (−40) e A (−100) ficam fora do período.
    expect(res.body.visitas.total).toBe(3);
    expect(res.body.visitas.mediaPorCliente).toBe(1);
    // 2 vendas em 3 visitas.
    expect(res.body.conversaoEmVendas).toEqual({ numerador: 2, denominador: 3, percentual: 67 });
    // A por visita e C por mensagem; B (visita há 40 dias) fora; D inativo não entra.
    expect(res.body.taxaDeRegistro).toEqual({ numerador: 2, denominador: 3, percentual: 67 });

    const { distribuicao, total } = res.body.inativos;
    expect(Object.values(distribuicao as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(3);
    expect(total).toBeLessThanOrEqual(3);
    expect(res.body.semDados).toBe(false);
    expect(typeof res.body.simulado).toBe('boolean');
  });

  it('periodoDias ausente usa 30; 90 inclui a visita de 40 dias e 365 a de 100 dias', async () => {
    const padrao = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenGestor}`);
    const noventa = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias: 90 })
      .set('Authorization', `Bearer ${tokenGestor}`);
    const anual = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias: 365 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(padrao.status).toBe(200);
    expect(padrao.body.periodo.dias).toBe(30);
    expect(padrao.body.visitas.total).toBe(3);

    expect(noventa.status).toBe(200);
    expect(noventa.body.periodo.dias).toBe(90);
    expect(noventa.body.visitas.total).toBe(4);

    expect(anual.status).toBe(200);
    expect(anual.body.periodo.dias).toBe(365);
    expect(anual.body.visitas.total).toBe(5);
  });

  it('semDados é true quando o período não tem visita nem mensagem', async () => {
    await truncateAllTables();
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
    representanteId = representante.id;
    await prisma.user.create({ data: { ...GESTOR, senhaHash } });
    tokenGestor = await logar(GESTOR.email);
    await criarClientes();

    const res = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.semDados).toBe(true);
    expect(res.body.visitas.total).toBe(0);
    expect(res.body.conversaoEmVendas.percentual).toBeNull();
    expect(res.body.taxaDeRegistro).toEqual({ numerador: 0, denominador: 3, percentual: 0 });
  });
});
