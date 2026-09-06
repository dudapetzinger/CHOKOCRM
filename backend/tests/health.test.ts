import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /health', () => {
  it('responde 200 com status ok e banco ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('rota inexistente responde 404 no formato de erro padrão', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 503 no formato de erro padrão quando o banco falha', async () => {
    const spy = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('conexão recusada'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    spy.mockRestore();
  });
});
