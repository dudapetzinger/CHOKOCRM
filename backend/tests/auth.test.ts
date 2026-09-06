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
  email: 'eduarda.teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'gestor.teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

/**
 * App isolado, montado apenas para este arquivo de teste, usado para
 * exercitar `requireRole` sem depender de uma rota real de produção
 * (que ainda não existe nesta task — o único endpoint protegido "real"
 * hoje é GET /auth/me, sem exigência de papel específico).
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
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      nome: REPRESENTANTE.nome,
      email: REPRESENTANTE.email,
      role: REPRESENTANTE.role,
    });
    expect(res.body.user.senhaHash).toBeUndefined();

    const decodificado = jwt.verify(res.body.token, env.JWT_SECRET);
    expect(decodificado).toMatchObject({ sub: res.body.user.id, role: REPRESENTANTE.role });
  });

  it('senha errada responde 401 com mensagem genérica', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
  });

  it('e-mail inexistente responde 401 com a mesma mensagem genérica', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ninguem@chokolaten.com.br', senha: SENHA_PADRAO });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
  });

  it('body sem email responde 400 VALIDATION_ERROR', async () => {
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

  it('com token válido responde 200 com req.user', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: login.body.user.id, role: REPRESENTANTE.role });
  });
});

describe("requireRole('GESTOR') em rota protegida de teste", () => {
  it('usuário com papel diferente do exigido responde 403', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    const testApp = buildRotaDeTesteComRole();
    const res = await request(testApp)
      .get('/rota-gestor')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('usuário com o papel exigido responde 200', async () => {
    const login = await request(app).post('/auth/login').send({ email: GESTOR.email, senha: SENHA_PADRAO });

    const testApp = buildRotaDeTesteComRole();
    const res = await request(testApp)
      .get('/rota-gestor')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: login.body.user.id, role: GESTOR.role });
  });
});
