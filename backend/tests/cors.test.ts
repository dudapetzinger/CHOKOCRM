import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

/**
 * Testa apenas o middleware `cors()` (ver `app.ts`), usando POST /auth/login
 * com um corpo inválido — a validação do Zod responde 400 antes de qualquer
 * acesso ao banco (ver `postLogin`/`loginSchema` em `auth.controller.ts`),
 * então este arquivo não usa `truncateAllTables` nem depende de dados.
 * Propositalmente não importa `prisma` nem faz `$disconnect`, já que nenhuma
 * query é executada.
 */
describe('CORS', () => {
  it('origem igual a FRONTEND_URL recebe Access-Control-Allow-Origin correspondente', async () => {
    const res = await request(app).post('/auth/login').set('Origin', env.FRONTEND_URL).send({});

    expect(res.status).toBe(400);
    expect(res.headers['access-control-allow-origin']).toBe(env.FRONTEND_URL);
  });

  it('origem diferente de FRONTEND_URL não recebe o header Access-Control-Allow-Origin', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://origem-nao-autorizada.example.com')
      .send({});

    expect(res.status).toBe(400);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
