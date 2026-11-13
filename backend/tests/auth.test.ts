import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { errorHandler } from '../src/middlewares/errorHandler';
import { authJwt } from '../src/middlewares/authJwt';
import { requireRole } from '../src/middlewares/requireRole';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  usuario: 'eduarda.teste',
  telefone: '(47) 99911-2233',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  usuario: 'gestor.teste',
  role: 'GESTOR' as const,
};

/**
 * App isolado, montado apenas para este arquivo de teste, usado para
 * exercitar `requireRole` sem depender de uma rota real de produção.
 */
function buildRotaDeTesteComRole(): Express {
  const testApp = express();
  testApp.get('/rota-gestor', authJwt, requireRole('GESTOR'), (req, res) => {
    res.status(200).json({ ok: true, user: req.user });
  });
  testApp.use(errorHandler);
  return testApp;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  await prisma.user.create({
    data: { ...REPRESENTANTE, senhaHash },
  });
  await prisma.user.create({
    data: { ...GESTOR, senhaHash },
  });
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('login com credenciais corretas devolve token decodificável e usuário sem senhaHash', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      nome: REPRESENTANTE.nome,
      usuario: REPRESENTANTE.usuario,
      telefone: '(47) 99911-2233',
      role: REPRESENTANTE.role,
      ativo: true,
    });
    expect(res.body.user.senhaHash).toBeUndefined();

    const decodificado = jwt.verify(res.body.token, env.JWT_SECRET);
    expect(decodificado).toMatchObject({ sub: res.body.user.id, role: REPRESENTANTE.role });
  });

  it('senha errada responde 401 com mensagem genérica', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Usuário ou senha inválidos');
  });

  it('usuário inexistente responde 401 com a mesma mensagem genérica', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ usuario: 'ninguem', senha: SENHA_PADRAO });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Usuário ou senha inválidos');
  });

  it('usuário com maiúsculas entra (o usuário é comparado em minúsculas)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ usuario: 'Eduarda.Teste', senha: SENHA_PADRAO });

    expect(res.status).toBe(200);
    expect(res.body.user.usuario).toBe(REPRESENTANTE.usuario);
  });

  it('conta inativa com a senha certa responde 403 "Conta inativa. Fale com o gestor."', async () => {
    await prisma.user.update({ where: { usuario: REPRESENTANTE.usuario }, data: { ativo: false } });

    const res = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toBe('Conta inativa. Fale com o gestor.');
    expect(res.body.token).toBeUndefined();
  });

  it('conta inativa com a senha errada responde o 401 genérico (não revela a inativação)', async () => {
    await prisma.user.update({ where: { usuario: REPRESENTANTE.usuario }, data: { ativo: false } });

    const res = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Usuário ou senha inválidos');
  });

  it('body sem usuario responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/auth/login').send({ senha: SENHA_PADRAO });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me (exemplo de rota protegida por authJwt)', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('com token inválido responde 401', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer token-invalido');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('com token válido responde 200 com o usuário lido do banco (com ativo e telefone)', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: login.body.user.id,
      nome: REPRESENTANTE.nome,
      usuario: REPRESENTANTE.usuario,
      telefone: REPRESENTANTE.telefone,
      role: REPRESENTANTE.role,
      ativo: true,
    });
  });

  it('reflete o que mudou no banco depois do login', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });
    await prisma.user.update({ where: { id: login.body.user.id }, data: { nome: 'Eduarda F.', telefone: null } });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nome: 'Eduarda F.', telefone: null });
  });
});

describe("requireRole('GESTOR') em rota protegida de teste", () => {
  it('usuário com papel diferente do exigido responde 403', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });

    const testApp = buildRotaDeTesteComRole();
    const res = await request(testApp)
      .get('/rota-gestor')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('usuário com o papel exigido responde 200', async () => {
    const login = await request(app).post('/auth/login').send({ usuario: GESTOR.usuario, senha: SENHA_PADRAO });

    const testApp = buildRotaDeTesteComRole();
    const res = await request(testApp)
      .get('/rota-gestor')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: login.body.user.id, role: GESTOR.role });
  });
});

describe('PUT /auth/password', () => {
  async function tokenDaRepresentante(): Promise<string> {
    const login = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });
    return login.body.token;
  }

  it('sem token responde 401', async () => {
    const res = await request(app)
      .put('/auth/password')
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha' });

    expect(res.status).toBe(401);
  });

  // 400, não 401: o front trata todo 401 com token como sessão vencida e
  // desloga; senha atual errada é erro de digitação, não de sessão.
  it('senha atual errada responde 400 "Senha atual incorreta." e nada muda', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${await tokenDaRepresentante()}`)
      .send({ senhaAtual: 'senha-errada', novaSenha: 'nova-senha' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Senha atual incorreta.');

    const login = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });
    expect(login.status).toBe(200);
  });

  it('senha nova com menos de 6 caracteres responde 400', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${await tokenDaRepresentante()}`)
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'novaSenha', message: 'A senha deve ter pelo menos 6 caracteres.' },
    ]);
  });

  it('com a senha atual certa responde 204, a nova entra e a antiga não', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${await tokenDaRepresentante()}`)
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha' });

    expect(res.status).toBe(204);

    const comNova = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: 'nova-senha' });
    expect(comNova.status).toBe(200);

    const comAntiga = await request(app)
      .post('/auth/login')
      .send({ usuario: REPRESENTANTE.usuario, senha: SENHA_PADRAO });
    expect(comAntiga.status).toBe(401);
  });
});

describe('sem redefinição de senha por e-mail', () => {
  it('POST /auth/redefinir-senha responde 404', async () => {
    const res = await request(app).post('/auth/redefinir-senha').send({ token: 'qualquer', novaSenha: 'senha-nova' });

    expect(res.status).toBe(404);
  });
});
