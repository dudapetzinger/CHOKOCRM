import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { ResultadoVisita } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE_A = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.agenda-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_B = {
  nome: 'Bruno Alencar',
  email: 'bruno.agenda-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_C = {
  nome: 'Carla Nunes',
  email: 'carla.agenda-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.agenda-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let tokenA: string;
let tokenC: string;
let tokenGestor: string;
let representanteAId: string;
let representanteBId: string;
let clienteAtrasadoId: string;
let clienteHojeId: string;
let clienteFuturoId: string;
let clienteBId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function criarCliente(
  cnpj: string,
  nomeFantasia: string,
  representanteId: string,
  opts: { ativo?: boolean; recorrenciaDias?: number } = {},
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
      ativo: opts.ativo ?? true,
      recorrenciaDias: opts.recorrenciaDias ?? 15,
      representanteId,
    },
  });
  return cliente.id;
}

async function criarVisita(
  clienteId: string,
  userId: string,
  diasAtras: number,
  resultado: ResultadoVisita = 'VENDA',
): Promise<void> {
  await prisma.visit.create({
    data: {
      clientId: clienteId,
      userId,
      dataHora: new Date(Date.now() - diasAtras * 86_400_000),
      descricao: 'Visita de teste.',
      resultado,
    },
  });
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representanteA = await prisma.user.create({ data: { ...REPRESENTANTE_A, senhaHash } });
  const representanteB = await prisma.user.create({ data: { ...REPRESENTANTE_B, senhaHash } });
  await prisma.user.create({ data: { ...REPRESENTANTE_C, senhaHash } });
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });
  representanteAId = representanteA.id;
  representanteBId = representanteB.id;

  tokenA = await logar(REPRESENTANTE_A.email);
  tokenC = await logar(REPRESENTANTE_C.email);
  tokenGestor = await logar(GESTOR.email);

  clienteAtrasadoId = await criarCliente('11222333000181', 'Emporio Pomerode', representanteAId);
  clienteHojeId = await criarCliente('11222333000262', 'Cafe Blumenau', representanteAId);
  clienteFuturoId = await criarCliente('11222333000343', 'Doceria Jaragua', representanteAId);
  const clienteInativoId = await criarCliente('11222333000424', 'Chocolates Timbo', representanteAId, {
    ativo: false,
  });
  clienteBId = await criarCliente('11222333000505', 'Bombons Indaial', representanteBId);

  await criarVisita(clienteAtrasadoId, representanteAId, 20);
  await criarVisita(clienteHojeId, representanteAId, 15);
  await criarVisita(clienteFuturoId, representanteAId, 3);
  await criarVisita(clienteInativoId, representanteAId, 40);
  await criarVisita(clienteBId, representanteBId, 40);
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /agenda/today', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/agenda/today');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante vê só a própria carteira, sem inativos e sem visitas futuras', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.atrasadas.map((item: { id: string }) => item.id)).toEqual([clienteAtrasadoId]);
    expect(res.body.data.hoje.map((item: { id: string }) => item.id)).toEqual([clienteHojeId]);
  });

  it('gestor vê a agenda de todos os representantes', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    const idsAtrasadas = res.body.data.atrasadas.map((item: { id: string }) => item.id);
    expect(idsAtrasadas).toHaveLength(2);
    expect(idsAtrasadas).toEqual(expect.arrayContaining([clienteAtrasadoId, clienteBId]));
  });

  it('representante sem clientes recebe listas vazias', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ atrasadas: [], hoje: [] });
  });

  it('item traz cor, diasSemVisita, proximaVisita YYYY-MM-DD e diasAtraso', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const [item] = res.body.data.atrasadas;
    expect(item).toMatchObject({
      id: clienteAtrasadoId,
      nomeFantasia: 'Emporio Pomerode',
      cidade: 'Pomerode',
      cor: 'LARANJA',
      diasSemVisita: 20,
      diasAtraso: 5,
    });
    expect(item.proximaVisita).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
