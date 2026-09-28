import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.recurrence-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.recurrence-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let representanteId: string;
let clienteId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function criarCliente(cnpj: string, nomeFantasia: string): Promise<string> {
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
      contacts: {
        create: [
          {
            nome: 'Marta Weber',
            cargo: 'Compradora',
            telefone: '(47) 99911-2233',
            email: `marta@${apelido(nomeFantasia)}.com.br`,
            principal: true,
          },
        ],
      },
    },
  });
  return cliente.id;
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  clienteId = await criarCliente('11222333000181', 'Emporio Pomerode');
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

function payload(overrides: Record<string, unknown> = {}) {
  return {
    recorrenciaDias: 45,
    justificativa: 'Cliente pediu visitas mais espaçadas.',
    ...overrides,
  };
}

describe('PUT /clients/:id/recurrence', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).put(`/clients/${clienteId}/recurrence`).send(payload());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('gestor responde 403', async () => {
    const res = await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send(payload());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('sem justificativa responde 400', async () => {
    const res = await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorrenciaDias: 45 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('justificativa só com espaços responde 400', async () => {
    const res = await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload({ justificativa: '   ' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('valor igual ao atual responde 400', async () => {
    const res = await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload({ recorrenciaDias: 15 }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cliente inexistente responde 404', async () => {
    const res = await request(app)
      .put(`/clients/${ID_INEXISTENTE}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('altera a recorrência, grava o histórico e devolve a ficha', async () => {
    const res = await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorrenciaDias: 45, justificativa: 'Cliente pediu visitas mais espaçadas.' });

    expect(res.status).toBe(200);
    expect(res.body.recorrenciaDias).toBe(45);
    expect(res.body.recorrenciaChanges).toHaveLength(1);
    expect(res.body.recorrenciaChanges[0]).toMatchObject({
      de: 15,
      para: 45,
      justificativa: 'Cliente pediu visitas mais espaçadas.',
      autor: { id: representanteId },
    });

    const registro = await prisma.visitScheduleChange.findFirstOrThrow({ where: { clientId: clienteId } });
    expect(registro).toMatchObject({ recorrenciaAnterior: 15, recorrenciaNova: 45, userId: representanteId });
  });

  it('duas alterações aparecem na ficha da mais recente para a mais antiga', async () => {
    await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorrenciaDias: 30, justificativa: 'Primeira alteração de recorrência.' });

    const res = await request(app)
      .put(`/clients/${clienteId}/recurrence`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recorrenciaDias: 60, justificativa: 'Segunda alteração de recorrência.' });

    expect(res.status).toBe(200);
    expect(res.body.recorrenciaChanges).toHaveLength(2);
    expect(res.body.recorrenciaChanges[0]).toMatchObject({
      de: 30,
      para: 60,
      justificativa: 'Segunda alteração de recorrência.',
    });
    expect(res.body.recorrenciaChanges[1]).toMatchObject({
      de: 15,
      para: 30,
      justificativa: 'Primeira alteração de recorrência.',
    });
  });
});
