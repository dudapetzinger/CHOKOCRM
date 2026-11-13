import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const GESTOR = {
  nome: 'Gestão Chokolaten',
  usuario: 'gestao.users-teste',
  role: 'GESTOR' as const,
};

const REPRESENTANTE_B = {
  nome: 'Rafael Schmitt',
  usuario: 'rafael.users-teste',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_A = {
  nome: 'Eduarda Fischer',
  usuario: 'eduarda.users-teste',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_INATIVO = {
  nome: 'Bruno Alencar',
  usuario: 'bruno.users-teste',
  role: 'REPRESENTANTE' as const,
  ativo: false,
};

let tokenGestor: string;
let tokenRepresentante: string;
let gestorId: string;
let representanteAId: string;
let representanteBId: string;
let inativoId: string;

async function logar(usuario: string, senha = SENHA_PADRAO): Promise<request.Response> {
  return request(app).post('/auth/login').send({ usuario, senha });
}

let proximoCnpj = 0;

async function criarCliente(representanteId: string, nomeFantasia: string, ativo = true): Promise<string> {
  proximoCnpj += 1;
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj: String(11222333000100 + proximoCnpj),
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 620 - Centro, Pomerode/SC',
      telefone: '(47) 3395-1122',
      email: 'contato@cliente-users-teste.com.br',
      ativo,
      representanteId,
    },
  });
  return cliente.id;
}

function autenticado(req: request.Test, token: string): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  // Criados fora da ordem alfabética para provar a ordenação por nome.
  representanteBId = (await prisma.user.create({ data: { ...REPRESENTANTE_B, senhaHash } })).id;
  gestorId = (await prisma.user.create({ data: { ...GESTOR, senhaHash } })).id;
  representanteAId = (await prisma.user.create({ data: { ...REPRESENTANTE_A, senhaHash } })).id;
  inativoId = (await prisma.user.create({ data: { ...REPRESENTANTE_INATIVO, senhaHash } })).id;

  tokenGestor = (await logar(GESTOR.usuario)).body.token;
  tokenRepresentante = (await logar(REPRESENTANTE_A.usuario)).body.token;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /users', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/users?role=REPRESENTANTE');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante responde 403', async () => {
    const res = await autenticado(request(app).get('/users?role=REPRESENTANTE'), tokenRepresentante);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('?role=REPRESENTANTE traz só os representantes ativos (id e nome), ordenados por nome', async () => {
    const res = await autenticado(request(app).get('/users?role=REPRESENTANTE'), tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: representanteAId, nome: 'Eduarda Fischer' },
      { id: representanteBId, nome: 'Rafael Schmitt' },
    ]);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'nome']);
  });

  it('role=GESTOR responde 400', async () => {
    const res = await autenticado(request(app).get('/users?role=GESTOR'), tokenGestor);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sem role traz todos, ordenados por nome, com clientesNaCarteira (só clientes ativos)', async () => {
    await criarCliente(representanteAId, 'Empório Pomerode');
    await criarCliente(representanteAId, 'Café Blumenau');
    await criarCliente(representanteAId, 'Padaria Fechada', false);
    await criarCliente(inativoId, 'Mercearia Gaspar');

    const res = await autenticado(request(app).get('/users'), tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { nome: string }) => u.nome)).toEqual([
      'Bruno Alencar',
      'Eduarda Fischer',
      'Gestão Chokolaten',
      'Rafael Schmitt',
    ]);
    expect(res.body.data[1]).toEqual({
      id: representanteAId,
      nome: REPRESENTANTE_A.nome,
      usuario: REPRESENTANTE_A.usuario,
      telefone: null,
      role: 'REPRESENTANTE',
      ativo: true,
      criadoEm: expect.any(String),
      clientesNaCarteira: 2,
    });
    expect(res.body.data[0]).toMatchObject({ id: inativoId, ativo: false, clientesNaCarteira: 1 });
    expect(res.body.data[2]).toMatchObject({ id: gestorId, role: 'GESTOR', clientesNaCarteira: 0 });
    expect(res.body.data[2].senhaHash).toBeUndefined();
  });
});

describe('POST /users', () => {
  const NOVO = {
    nome: 'Carla Hoffmann',
    usuario: 'Carla.Hoffmann',
    telefone: '(47) 99988-7766',
    role: 'REPRESENTANTE',
    senha: 'segredo1',
  };

  it('cria a conta (201) com usuário em minúsculas, e ela entra com a senha inicial', async () => {
    const res = await autenticado(request(app).post('/users'), tokenGestor).send(NOVO);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      nome: 'Carla Hoffmann',
      usuario: 'carla.hoffmann',
      telefone: '(47) 99988-7766',
      role: 'REPRESENTANTE',
      ativo: true,
      criadoEm: expect.any(String),
      clientesNaCarteira: 0,
    });

    const login = await logar('carla.hoffmann', 'segredo1');
    expect(login.status).toBe(200);
  });

  it('sem telefone grava null', async () => {
    const { telefone: _telefone, ...semTelefone } = NOVO;

    const res = await autenticado(request(app).post('/users'), tokenGestor).send(semTelefone);

    expect(res.status).toBe(201);
    expect(res.body.telefone).toBeNull();
  });

  it('senha com 5 caracteres responde 400', async () => {
    const res = await autenticado(request(app).post('/users'), tokenGestor).send({ ...NOVO, senha: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([
      { path: 'senha', message: 'A senha deve ter pelo menos 6 caracteres.' },
    ]);
    expect(await prisma.user.count({ where: { usuario: 'carla.hoffmann' } })).toBe(0);
  });

  it('e-mail de um usuário existente, com outra caixa, responde 409', async () => {
    const res = await autenticado(request(app).post('/users'), tokenGestor).send({
      ...NOVO,
      usuario: 'Rafael.Users-Teste',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Já existe uma conta com este usuário.');
  });
});

describe('PATCH /users/:id', () => {
  it('edita nome, usuário (em minúsculas), telefone e papel', async () => {
    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      nome: 'Rafael S. Schmitt',
      usuario: 'Rafael.Novo',
      telefone: '(47) 99911-0000',
      role: 'GESTOR',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: representanteBId,
      nome: 'Rafael S. Schmitt',
      usuario: 'rafael.novo',
      telefone: '(47) 99911-0000',
      role: 'GESTOR',
      ativo: true,
      clientesNaCarteira: 0,
    });
  });

  it('telefone null (ou vazio) apaga o telefone', async () => {
    await prisma.user.update({ where: { id: representanteBId }, data: { telefone: '(47) 99911-0000' } });

    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      telefone: '',
    });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBeNull();
  });

  it('e-mail de outro usuário, com outra caixa, responde 409 e nada muda', async () => {
    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      usuario: 'EDUARDA.users-teste',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Já existe uma conta com este usuário.');
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: representanteBId } });
    expect(salvo.usuario).toBe(REPRESENTANTE_B.usuario);
  });

  it('manter o próprio usuário (com outra caixa) não é conflito', async () => {
    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      usuario: 'RAFAEL.users-teste',
    });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toBe(REPRESENTANTE_B.usuario);
  });

  it('inativa e reativa outro usuário', async () => {
    const inativar = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      ativo: false,
    });
    expect(inativar.status).toBe(200);
    expect(inativar.body.ativo).toBe(false);

    const reativar = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      ativo: true,
    });
    expect(reativar.status).toBe(200);
    expect(reativar.body.ativo).toBe(true);
  });

  it('gestor não inativa a própria conta (400) e nada muda', async () => {
    const res = await autenticado(request(app).patch(`/users/${gestorId}`), tokenGestor).send({ ativo: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Você não pode inativar a própria conta.');
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: gestorId } });
    expect(salvo.ativo).toBe(true);
  });

  it('gestor não muda o próprio papel (400)', async () => {
    const res = await autenticado(request(app).patch(`/users/${gestorId}`), tokenGestor).send({
      role: 'REPRESENTANTE',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Você não pode mudar o próprio papel.');
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: gestorId } });
    expect(salvo.role).toBe('GESTOR');
  });

  it('gestor edita os próprios dados sem mexer no papel', async () => {
    const res = await autenticado(request(app).patch(`/users/${gestorId}`), tokenGestor).send({
      nome: 'Gestão Chokolaten SC',
      role: 'GESTOR',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nome: 'Gestão Chokolaten SC', role: 'GESTOR' });
  });

  it('representante com cliente ativo não vira gestor (400)', async () => {
    await criarCliente(representanteAId, 'Empório Pomerode');

    const res = await autenticado(request(app).patch(`/users/${representanteAId}`), tokenGestor).send({
      role: 'GESTOR',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Transfira a carteira antes de mudar o papel.');
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: representanteAId } });
    expect(salvo.role).toBe('REPRESENTANTE');
  });

  it('usuário inexistente responde 404', async () => {
    const res = await autenticado(
      request(app).patch('/users/00000000-0000-0000-0000-000000000000'),
      tokenGestor,
    ).send({ nome: 'Ninguém' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('campo desconhecido (ex.: senhaHash) responde 400', async () => {
    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      senhaHash: 'x',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /users/:id/transferir-carteira', () => {
  it('move todos os clientes (ativos e inativos) e devolve quantos foram', async () => {
    const ativo1 = await criarCliente(representanteAId, 'Empório Pomerode');
    const ativo2 = await criarCliente(representanteAId, 'Café Blumenau');
    const inativo = await criarCliente(representanteAId, 'Padaria Fechada', false);
    const deOutro = await criarCliente(inativoId, 'Mercearia Gaspar');

    const res = await autenticado(
      request(app).post(`/users/${representanteAId}/transferir-carteira`),
      tokenGestor,
    ).send({ destinoId: representanteBId });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transferidos: 3 });

    const donos = await prisma.client.findMany({
      where: { id: { in: [ativo1, ativo2, inativo, deOutro] } },
      select: { id: true, representanteId: true },
    });
    const donoDe = new Map(donos.map((c) => [c.id, c.representanteId]));
    expect(donoDe.get(ativo1)).toBe(representanteBId);
    expect(donoDe.get(ativo2)).toBe(representanteBId);
    expect(donoDe.get(inativo)).toBe(representanteBId);
    expect(donoDe.get(deOutro)).toBe(inativoId);
  });

  it('a carteira de um representante inativo pode ser transferida', async () => {
    await criarCliente(inativoId, 'Mercearia Gaspar');

    const res = await autenticado(request(app).post(`/users/${inativoId}/transferir-carteira`), tokenGestor).send({
      destinoId: representanteAId,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ transferidos: 1 });
  });

  it('destino inativo responde 400 "Representante inativo." e nada muda', async () => {
    const cliente = await criarCliente(representanteAId, 'Empório Pomerode');

    const res = await autenticado(
      request(app).post(`/users/${representanteAId}/transferir-carteira`),
      tokenGestor,
    ).send({ destinoId: inativoId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Representante inativo.');
    const salvo = await prisma.client.findUniqueOrThrow({ where: { id: cliente } });
    expect(salvo.representanteId).toBe(representanteAId);
  });

  it('destino gestor ou inexistente responde 400', async () => {
    const paraGestor = await autenticado(
      request(app).post(`/users/${representanteAId}/transferir-carteira`),
      tokenGestor,
    ).send({ destinoId: gestorId });
    expect(paraGestor.status).toBe(400);

    const paraNinguem = await autenticado(
      request(app).post(`/users/${representanteAId}/transferir-carteira`),
      tokenGestor,
    ).send({ destinoId: '00000000-0000-0000-0000-000000000000' });
    expect(paraNinguem.status).toBe(400);
  });

  it('destino igual à origem responde 400', async () => {
    const res = await autenticado(
      request(app).post(`/users/${representanteAId}/transferir-carteira`),
      tokenGestor,
    ).send({ destinoId: representanteAId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('origem inexistente responde 404', async () => {
    const res = await autenticado(
      request(app).post('/users/00000000-0000-0000-0000-000000000000/transferir-carteira'),
      tokenGestor,
    ).send({ destinoId: representanteBId });

    expect(res.status).toBe(404);
  });
});

describe('PUT /users/:id/senha', () => {
  function definirSenha(id: string, senha: unknown, token = tokenGestor): request.Test {
    return autenticado(request(app).put(`/users/${id}/senha`), token).send({ senha });
  }

  it('o gestor define a senha provisória: 204, a nova entra e a antiga não', async () => {
    const res = await definirSenha(representanteBId, 'provisoria1');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect((await logar(REPRESENTANTE_B.usuario, 'provisoria1')).status).toBe(200);
    expect((await logar(REPRESENTANTE_B.usuario)).status).toBe(401);
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: representanteBId } });
    expect(salvo.senhaHash).not.toBe('provisoria1');
    expect(await bcrypt.compare('provisoria1', salvo.senhaHash)).toBe(true);
  });

  // Não há revogação de JWT: a sessão aberta continua até expirar.
  it('a sessão já aberta da pessoa continua valendo (GET /auth/me 200)', async () => {
    const res = await definirSenha(representanteAId, 'provisoria1');
    expect(res.status).toBe(204);

    const me = await autenticado(request(app).get('/auth/me'), tokenRepresentante);

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(representanteAId);
    expect((await logar(REPRESENTANTE_A.usuario)).status).toBe(401);
    expect((await logar(REPRESENTANTE_A.usuario, 'provisoria1')).status).toBe(200);
  });

  it('o gestor pode definir a da própria conta e a de uma conta inativa', async () => {
    expect((await definirSenha(gestorId, 'minha-nova')).status).toBe(204);
    expect((await logar(GESTOR.usuario, 'minha-nova')).status).toBe(200);

    expect((await definirSenha(inativoId, 'provisoria1')).status).toBe(204);
    const inativo = await prisma.user.findUniqueOrThrow({ where: { id: inativoId } });
    expect(await bcrypt.compare('provisoria1', inativo.senhaHash)).toBe(true);
    expect(inativo.ativo).toBe(false);
  });

  it('senha com menos de 6 caracteres (ou ausente) responde 400 e nada muda', async () => {
    const curta = await definirSenha(representanteBId, '12345');

    expect(curta.status).toBe(400);
    expect(curta.body.error.code).toBe('VALIDATION_ERROR');
    expect(curta.body.error.details).toEqual([
      { path: 'senha', message: 'A senha deve ter pelo menos 6 caracteres.' },
    ]);
    expect((await definirSenha(representanteBId, undefined)).status).toBe(400);
    expect((await logar(REPRESENTANTE_B.usuario)).status).toBe(200);
  });

  it('usuário inexistente responde 404', async () => {
    const res = await definirSenha('00000000-0000-0000-0000-000000000000', 'provisoria1');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Usuário não encontrado.');
  });

  it('representante responde 403 e a senha não muda', async () => {
    const res = await definirSenha(representanteBId, 'provisoria1', tokenRepresentante);

    expect(res.status).toBe(403);
    expect((await logar(REPRESENTANTE_B.usuario)).status).toBe(200);
  });

  it('sem token responde 401', async () => {
    const res = await request(app).put(`/users/${representanteBId}/senha`).send({ senha: 'provisoria1' });

    expect(res.status).toBe(401);
  });
});

describe('sem redefinição de senha por e-mail', () => {
  it('POST /users/:id/redefinicao-de-senha responde 404', async () => {
    const res = await autenticado(
      request(app).post(`/users/${representanteBId}/redefinicao-de-senha`),
      tokenGestor,
    );

    expect(res.status).toBe(404);
  });
});

describe('autor conferido no banco (o JWT guarda o papel do momento do login)', () => {
  const GESTOR_B = {
    nome: 'Lúcia Brandt',
    usuario: 'lucia.users-teste',
    role: 'GESTOR' as const,
  };

  async function criarGestorB(): Promise<{ id: string; token: string }> {
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const { id } = await prisma.user.create({ data: { ...GESTOR_B, senhaHash } });
    return { id, token: (await logar(GESTOR_B.usuario)).body.token };
  }

  it('gestor inativado não se reativa com o token de antes (403) e continua inativo', async () => {
    const gestorB = await criarGestorB();
    const inativar = await autenticado(request(app).patch(`/users/${gestorB.id}`), tokenGestor).send({
      ativo: false,
    });
    expect(inativar.status).toBe(200);

    const res = await autenticado(request(app).patch(`/users/${gestorB.id}`), gestorB.token).send({ ativo: true });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: gestorB.id } });
    expect(salvo.ativo).toBe(false);
  });

  it('gestor rebaixado a representante não cria conta de gestor com o token de antes (403)', async () => {
    const gestorB = await criarGestorB();
    const rebaixar = await autenticado(request(app).patch(`/users/${gestorB.id}`), tokenGestor).send({
      role: 'REPRESENTANTE',
    });
    expect(rebaixar.status).toBe(200);

    const res = await autenticado(request(app).post('/users'), gestorB.token).send({
      nome: 'Conta Nova',
      usuario: 'conta.nova',
      role: 'GESTOR',
      senha: 'segredo1',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.user.count({ where: { usuario: 'conta.nova' } })).toBe(0);
  });

  it('gestor ativo segue usando o token normalmente', async () => {
    const gestorB = await criarGestorB();

    const res = await autenticado(request(app).get('/users'), gestorB.token);

    expect(res.status).toBe(200);
  });
});

describe('representante em qualquer rota de /users', () => {
  it('responde 403 e nada muda', async () => {
    const chamadas: request.Test[] = [
      request(app).get('/users'),
      request(app).get('/users?role=REPRESENTANTE'),
      request(app).post('/users').send({
        nome: 'X',
        usuario: 'x',
        role: 'GESTOR',
        senha: 'segredo1',
      }),
      request(app).patch(`/users/${representanteAId}`).send({ role: 'GESTOR' }),
      request(app).post(`/users/${representanteBId}/transferir-carteira`).send({ destinoId: representanteAId }),
      request(app).put(`/users/${representanteBId}/senha`).send({ senha: 'provisoria1' }),
    ];

    for (const chamada of chamadas) {
      const res = await autenticado(chamada, tokenRepresentante);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }

    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: representanteAId } });
    expect(salvo.role).toBe('REPRESENTANTE');
    expect(await prisma.user.count()).toBe(4);
    expect((await logar(REPRESENTANTE_B.usuario)).status).toBe(200);
  });
});
