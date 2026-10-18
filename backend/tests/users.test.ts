import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import * as provedorDeEmail from '../src/providers/email';
import { ConsoleEmailProvider } from '../src/providers/email/ConsoleEmailProvider';
import { hashDoToken } from '../src/services/redefinicao-senha.regras';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const GESTOR = {
  nome: 'Maicon Krüger',
  email: 'maicon.users-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

const REPRESENTANTE_B = {
  nome: 'Rafael Schmitt',
  email: 'rafael.users-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_A = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.users-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_INATIVO = {
  nome: 'Bruno Alencar',
  email: 'bruno.users-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
  ativo: false,
};

let tokenGestor: string;
let tokenRepresentante: string;
let gestorId: string;
let representanteAId: string;
let representanteBId: string;
let inativoId: string;

async function logar(email: string, senha = SENHA_PADRAO): Promise<request.Response> {
  return request(app).post('/auth/login').send({ email, senha });
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

/** Em teste não há SMTP: o provedor escolhido é o de console, que guarda o que "enviou". */
function caixaDeSaida(): ConsoleEmailProvider {
  const provedor = provedorDeEmail.emailProvider;
  if (!(provedor instanceof ConsoleEmailProvider)) {
    throw new Error('Os testes esperam o ConsoleEmailProvider (SMTP_HOST vazio, fora de produção).');
  }
  return provedor;
}

function autenticado(req: request.Test, token: string): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

beforeEach(async () => {
  await truncateAllTables();
  caixaDeSaida().enviados.length = 0;

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  // Criados fora da ordem alfabética para provar a ordenação por nome.
  representanteBId = (await prisma.user.create({ data: { ...REPRESENTANTE_B, senhaHash } })).id;
  gestorId = (await prisma.user.create({ data: { ...GESTOR, senhaHash } })).id;
  representanteAId = (await prisma.user.create({ data: { ...REPRESENTANTE_A, senhaHash } })).id;
  inativoId = (await prisma.user.create({ data: { ...REPRESENTANTE_INATIVO, senhaHash } })).id;

  tokenGestor = (await logar(GESTOR.email)).body.token;
  tokenRepresentante = (await logar(REPRESENTANTE_A.email)).body.token;
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
      'Maicon Krüger',
      'Rafael Schmitt',
    ]);
    expect(res.body.data[1]).toEqual({
      id: representanteAId,
      nome: REPRESENTANTE_A.nome,
      email: REPRESENTANTE_A.email,
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
    email: 'Carla.Hoffmann@Chokolaten.com.br',
    telefone: '(47) 99988-7766',
    role: 'REPRESENTANTE',
    senha: 'segredo1',
  };

  it('cria a conta (201) com e-mail em minúsculas, e ela entra com a senha inicial', async () => {
    const res = await autenticado(request(app).post('/users'), tokenGestor).send(NOVO);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      nome: 'Carla Hoffmann',
      email: 'carla.hoffmann@chokolaten.com.br',
      telefone: '(47) 99988-7766',
      role: 'REPRESENTANTE',
      ativo: true,
      criadoEm: expect.any(String),
      clientesNaCarteira: 0,
    });

    const login = await logar('carla.hoffmann@chokolaten.com.br', 'segredo1');
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
    expect(await prisma.user.count({ where: { email: 'carla.hoffmann@chokolaten.com.br' } })).toBe(0);
  });

  it('e-mail de um usuário existente, com outra caixa, responde 409', async () => {
    const res = await autenticado(request(app).post('/users'), tokenGestor).send({
      ...NOVO,
      email: 'Rafael.Users-Teste@Chokolaten.com.br',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Já existe um usuário com este e-mail.');
  });
});

describe('PATCH /users/:id', () => {
  it('edita nome, e-mail (em minúsculas), telefone e papel', async () => {
    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      nome: 'Rafael S. Schmitt',
      email: 'Rafael.Novo@Chokolaten.com.br',
      telefone: '(47) 99911-0000',
      role: 'GESTOR',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: representanteBId,
      nome: 'Rafael S. Schmitt',
      email: 'rafael.novo@chokolaten.com.br',
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
      email: 'EDUARDA.users-teste@chokolaten.com.br',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Já existe um usuário com este e-mail.');
    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: representanteBId } });
    expect(salvo.email).toBe(REPRESENTANTE_B.email);
  });

  it('manter o próprio e-mail (com outra caixa) não é conflito', async () => {
    const res = await autenticado(request(app).patch(`/users/${representanteBId}`), tokenGestor).send({
      email: 'RAFAEL.users-teste@chokolaten.com.br',
    });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(REPRESENTANTE_B.email);
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
      nome: 'Maicon K.',
      role: 'GESTOR',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nome: 'Maicon K.', role: 'GESTOR' });
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

describe('POST /users/:id/redefinicao-de-senha', () => {
  it('envia à pessoa um e-mail com o link APP_URL/redefinir-senha#<token>; o banco guarda só o hash', async () => {
    const res = await autenticado(
      request(app).post(`/users/${representanteBId}/redefinicao-de-senha`),
      tokenGestor,
    );

    expect(res.status).toBe(204);
    expect(caixaDeSaida().enviados).toHaveLength(1);
    const [mensagem] = caixaDeSaida().enviados;
    expect(mensagem?.para).toBe(REPRESENTANTE_B.email);
    expect(mensagem?.texto).toContain('Olá, Rafael Schmitt.');
    expect(mensagem?.texto).toContain('vale por 24 horas');

    // O token vai no fragmento (#), que o navegador não manda ao servidor
    // nem no Referer: fica fora dos logs e da telemetria (R15).
    const link = new RegExp(`${env.APP_URL.replace(/\/+$/, '')}/redefinir-senha#([A-Za-z0-9_-]{43})$`);
    const token = mensagem?.texto.match(link)?.[1];
    expect(token).toBeDefined();
    expect(mensagem?.texto).not.toContain('/redefinir-senha/');
    expect(mensagem?.html).toContain(`/redefinir-senha#${token}`);
    expect(mensagem?.html).toContain('Rafael Schmitt');

    const registros = await prisma.passwordResetToken.findMany({ where: { userId: representanteBId } });
    expect(registros).toHaveLength(1);
    expect(registros[0]?.tokenHash).toBe(hashDoToken(token ?? ''));
    expect(registros[0]?.tokenHash).not.toBe(token);
    expect(registros[0]?.usadoEm).toBeNull();
  });

  it('um novo pedido invalida o link anterior ainda aberto', async () => {
    await autenticado(request(app).post(`/users/${representanteBId}/redefinicao-de-senha`), tokenGestor);
    await autenticado(request(app).post(`/users/${representanteBId}/redefinicao-de-senha`), tokenGestor);

    const registros = await prisma.passwordResetToken.findMany({
      where: { userId: representanteBId },
      orderBy: { criadoEm: 'asc' },
    });
    expect(registros).toHaveLength(2);
    expect(registros.filter((r) => r.usadoEm === null)).toHaveLength(1);
  });

  it('conta inativa responde 400 e não envia nada', async () => {
    const res = await autenticado(request(app).post(`/users/${inativoId}/redefinicao-de-senha`), tokenGestor);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Reative a conta antes de redefinir a senha.');
    expect(caixaDeSaida().enviados).toHaveLength(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it('sem provedor de e-mail responde 503 e não grava token', async () => {
    const substituido = jest.replaceProperty(provedorDeEmail, 'emailProvider', null);

    try {
      const res = await autenticado(
        request(app).post(`/users/${representanteBId}/redefinicao-de-senha`),
        tokenGestor,
      );

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(res.body.error.message).toBe('Envio de e-mail não configurado.');
      expect(await prisma.passwordResetToken.count()).toBe(0);
    } finally {
      substituido.restore();
    }
  });

  it('usuário inexistente responde 404', async () => {
    const res = await autenticado(
      request(app).post('/users/00000000-0000-0000-0000-000000000000/redefinicao-de-senha'),
      tokenGestor,
    );

    expect(res.status).toBe(404);
  });

  it('falha no envio responde 503, não deixa link novo valendo e mantém o anterior', async () => {
    const pedir = (): request.Test =>
      autenticado(request(app).post(`/users/${representanteBId}/redefinicao-de-senha`), tokenGestor);
    expect((await pedir()).status).toBe(204);
    const anterior = caixaDeSaida().enviados.at(-1)?.texto.match(/#([A-Za-z0-9_-]{43})$/)?.[1] ?? '';
    jest.spyOn(caixaDeSaida(), 'enviar').mockRejectedValueOnce(new Error('SMTP fora do ar'));

    const res = await pedir();

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.message).toBe('Não foi possível enviar o e-mail.');
    expect(await prisma.passwordResetToken.count({ where: { userId: representanteBId } })).toBe(2);
    const abertos = await prisma.passwordResetToken.findMany({ where: { userId: representanteBId, usadoEm: null } });
    expect(abertos.map((registro) => registro.tokenHash)).toEqual([hashDoToken(anterior)]);

    const redefinir = await request(app).post('/auth/redefinir-senha').send({ token: anterior, novaSenha: 'senha-nova' });
    expect(redefinir.status).toBe(204);
  });
});

describe('autor conferido no banco (o JWT guarda o papel do momento do login)', () => {
  const GESTOR_B = {
    nome: 'Lúcia Brandt',
    email: 'lucia.users-teste@chokolaten.com.br',
    role: 'GESTOR' as const,
  };

  async function criarGestorB(): Promise<{ id: string; token: string }> {
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const { id } = await prisma.user.create({ data: { ...GESTOR_B, senhaHash } });
    return { id, token: (await logar(GESTOR_B.email)).body.token };
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
      email: 'conta.nova@chokolaten.com.br',
      role: 'GESTOR',
      senha: 'segredo1',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.user.count({ where: { email: 'conta.nova@chokolaten.com.br' } })).toBe(0);
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
        email: 'x@chokolaten.com.br',
        role: 'GESTOR',
        senha: 'segredo1',
      }),
      request(app).patch(`/users/${representanteAId}`).send({ role: 'GESTOR' }),
      request(app).post(`/users/${representanteBId}/transferir-carteira`).send({ destinoId: representanteAId }),
      request(app).post(`/users/${representanteBId}/redefinicao-de-senha`),
    ];

    for (const chamada of chamadas) {
      const res = await autenticado(chamada, tokenRepresentante);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }

    const salvo = await prisma.user.findUniqueOrThrow({ where: { id: representanteAId } });
    expect(salvo.role).toBe('REPRESENTANTE');
    expect(await prisma.user.count()).toBe(4);
    expect(caixaDeSaida().enviados).toHaveLength(0);
  });
});
