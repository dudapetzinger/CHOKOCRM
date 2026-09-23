import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.visits-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.visits-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let clienteId: string;
let clienteInativoId: string;
let contatoId: string;
let contatoDeOutroClienteId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function criarCliente(cnpj: string, nomeFantasia: string, ativo = true): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${apelido(nomeFantasia)}.com.br`,
      ativo,
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
  await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  clienteId = await criarCliente('11222333000181', 'Emporio Pomerode');
  clienteInativoId = await criarCliente('11222333000343', 'Doceria Jaragua', false);
  const outroClienteId = await criarCliente('11222333000262', 'Cafe Blumenau');

  const contato = await prisma.contact.findFirstOrThrow({ where: { clientId: clienteId } });
  contatoId = contato.id;
  const contatoDeOutro = await prisma.contact.findFirstOrThrow({ where: { clientId: outroClienteId } });
  contatoDeOutroClienteId = contatoDeOutro.id;
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

function payloadCheckIn(overrides: Record<string, unknown> = {}) {
  return {
    descricao: 'Reposição do mostruário e pedido de trufas.',
    resultado: 'VENDA',
    ...overrides,
  };
}

describe('POST /clients/:id/visits', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).post(`/clients/${clienteId}/visits`).send(payloadCheckIn());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('registra o check-in com data/hora automática e sem contato', async () => {
    const antes = Date.now();
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn());

    expect(res.status).toBe(201);
    expect(res.body.resultado).toBe('VENDA');
    expect(res.body.descricao).toBe('Reposição do mostruário e pedido de trufas.');
    expect(res.body.contato).toBeNull();
    expect(res.body.autor.nome).toBe('Eduarda Fischer');
    expect(res.body.temFoto).toBe(false);
    expect(res.body.editadoEm).toBeNull();
    expect(new Date(res.body.dataHora).getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });

  it('registra o check-in com contato do próprio cliente', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ contactId: contatoId }));

    expect(res.status).toBe(201);
    expect(res.body.contato).toEqual({ id: contatoId, nome: 'Marta Weber' });
  });

  it('aceita data/hora retroativa informada pelo representante', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ dataHora: '2026-09-10T14:00:00.000Z' }));

    expect(res.status).toBe(201);
    expect(res.body.dataHora).toBe('2026-09-10T14:00:00.000Z');
  });

  it('preserva o instante quando a data vem com offset de fuso', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ dataHora: '2026-09-10T11:30:00-03:00' }));

    expect(res.status).toBe(201);
    expect(res.body.dataHora).toBe('2026-09-10T14:30:00.000Z');
  });

  it('recusa descrição vazia', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ descricao: '' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa descrição composta só de espaços e quebras de linha', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ descricao: '   \n\t  ' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa resultado fora do enum', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ resultado: 'TALVEZ' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa data/hora no futuro', async () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ dataHora: amanha }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa contactId que não é UUID sem vazar erro do banco', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ contactId: 'nao-e-uuid' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa contato que pertence a outro cliente', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ contactId: contatoDeOutroClienteId }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa campo desconhecido no corpo', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn({ houveVenda: true }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('responde 404 para cliente inexistente', async () => {
    const res = await request(app)
      .post(`/clients/${ID_INEXISTENTE}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 409 para cliente inativo', async () => {
    const res = await request(app)
      .post(`/clients/${clienteInativoId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadCheckIn());

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('recusa o gestor registrando check-in', async () => {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send(payloadCheckIn());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('GET /clients/:id/visits', () => {
  async function criarVisita(descricao: string, dataHora: string, resultado = 'VENDA'): Promise<void> {
    await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao, resultado, dataHora });
  }

  it('sem token responde 401', async () => {
    const res = await request(app).get(`/clients/${clienteId}/visits`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('devolve lista vazia quando o cliente não tem visitas', async () => {
    const res = await request(app).get(`/clients/${clienteId}/visits`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('devolve as visitas da mais recente para a mais antiga', async () => {
    await criarVisita('Visita antiga.', '2026-09-01T13:00:00.000Z', 'SEM_VENDA');
    await criarVisita('Visita recente.', '2026-09-18T13:00:00.000Z', 'VENDA');
    await criarVisita('Visita do meio.', '2026-09-10T13:00:00.000Z', 'NEGOCIACAO');

    const res = await request(app).get(`/clients/${clienteId}/visits`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((v: { descricao: string }) => v.descricao)).toEqual([
      'Visita recente.',
      'Visita do meio.',
      'Visita antiga.',
    ]);
  });

  it('não vaza visita de outro cliente', async () => {
    await criarVisita('Visita do Empório.', '2026-09-18T13:00:00.000Z');

    const res = await request(app)
      .get(`/clients/${clienteInativoId}/visits`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('permite que o gestor leia a timeline', async () => {
    await criarVisita('Visita para o gestor ver.', '2026-09-18T13:00:00.000Z');

    const res = await request(app)
      .get(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('responde 404 para cliente inexistente', async () => {
    const res = await request(app)
      .get(`/clients/${ID_INEXISTENTE}/visits`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /visits/:id', () => {
  async function criarVisitaRetornandoId(): Promise<string> {
    const res = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Descrição original da visita.', resultado: 'NEGOCIACAO' });
    return res.body.id;
  }

  it('edita a descrição e grava a marca de edição', async () => {
    const id = await criarVisitaRetornandoId();

    const res = await request(app)
      .patch(`/visits/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Descrição corrigida: fechou 12 caixas de trufa.' });

    expect(res.status).toBe(200);
    expect(res.body.descricao).toBe('Descrição corrigida: fechou 12 caixas de trufa.');
    expect(res.body.editadoEm).not.toBeNull();
    expect(res.body.resultado).toBe('NEGOCIACAO');
  });

  it('recusa campo diferente de descricao', async () => {
    const id = await criarVisitaRetornandoId();

    const res = await request(app)
      .patch(`/visits/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Tentando mudar o resultado.', resultado: 'VENDA' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa descrição vazia na edição', async () => {
    const id = await criarVisitaRetornandoId();

    const res = await request(app)
      .patch(`/visits/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: '  ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa edição por quem não é o autor', async () => {
    const id = await criarVisitaRetornandoId();

    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    await prisma.user.create({
      data: {
        nome: 'Outro Representante',
        email: 'outro.visits-teste@chokolaten.com.br',
        role: 'REPRESENTANTE',
        senhaHash,
      },
    });
    const tokenOutro = await logar('outro.visits-teste@chokolaten.com.br');

    const res = await request(app)
      .patch(`/visits/${id}`)
      .set('Authorization', `Bearer ${tokenOutro}`)
      .send({ descricao: 'Editando a visita de outra pessoa.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('recusa o gestor editando', async () => {
    const id = await criarVisitaRetornandoId();

    const res = await request(app)
      .patch(`/visits/${id}`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ descricao: 'Gestor tentando editar.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('responde 404 para visita inexistente', async () => {
    const res = await request(app)
      .patch(`/visits/${ID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Visita que não existe.' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
