import { DATA_SIMULADA, deslocamentoEsperado } from './helpers/data-de-demonstracao';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { dataCalendario } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

/**
 * `GET /sistema/relogio` com o relógio de demonstração ligado
 * (`helpers/data-de-demonstracao`, importado primeiro): o front lê daqui o
 * deslocamento e se mostra a faixa "Data simulada".
 */
const SENHA_PADRAO = 'chokocrm123';
const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.sistema-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

let token: string;

beforeAll(async () => {
  await truncateAllTables();
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  const login = await request(app).post('/auth/login').send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
  token = login.body.token;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /sistema/relogio', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/sistema/relogio');

    expect(res.status).toBe(401);
  });

  it('com o representante responde a data simulada e o deslocamento', async () => {
    const res = await request(app).get('/sistema/relogio').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      agora: expect.any(String),
      simulado: true,
      dataDeDemonstracao: DATA_SIMULADA,
      deslocamentoDias: deslocamentoEsperado(),
    });
    expect(new Date(res.body.agora).toISOString()).toBe(res.body.agora);
    expect(dataCalendario(new Date(res.body.agora))).toBe(DATA_SIMULADA);
  });
});
