import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { dataCalendario } from '../src/services/classificacao.service';
import {
  ativarDataDeDemonstracao,
  DATA_SIMULADA,
  desativarDataDeDemonstracao,
  deslocamentoEsperado,
} from './helpers/data-de-demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * `GET /sistema/relogio` é público (a tela de login também mostra o modo
 * demonstração): o front lê daqui o deslocamento e se mostra a faixa
 * "Modo demonstração". A data vem da tabela `configuracoes`, ligada pelo
 * helper `ativarDataDeDemonstracao`.
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
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 4);
  await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  const login = await request(app).post('/auth/login').send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
  token = login.body.token;
});

afterAll(async () => {
  await desativarDataDeDemonstracao();
  await prisma.$disconnect();
});

describe('GET /sistema/relogio', () => {
  it('sem data de demonstração, responde o relógio real, sem token', async () => {
    await desativarDataDeDemonstracao();

    const res = await request(app).get('/sistema/relogio');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      agora: expect.any(String),
      simulado: false,
      dataDeDemonstracao: null,
      diaDeReferencia: null,
      deslocamentoDias: 0,
    });
    expect(Math.abs(new Date(res.body.agora).getTime() - Date.now())).toBeLessThan(5000);
  });

  it('com a data ligada, responde a data simulada e o deslocamento, sem token', async () => {
    await ativarDataDeDemonstracao();

    const res = await request(app).get('/sistema/relogio');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      agora: expect.any(String),
      simulado: true,
      dataDeDemonstracao: DATA_SIMULADA,
      diaDeReferencia: dataCalendario(new Date()),
      deslocamentoDias: deslocamentoEsperado(),
    });
    expect(new Date(res.body.agora).toISOString()).toBe(res.body.agora);
    expect(dataCalendario(new Date(res.body.agora))).toBe(DATA_SIMULADA);
  });

  it('com token, responde igual', async () => {
    await ativarDataDeDemonstracao();

    const res = await request(app).get('/sistema/relogio').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ simulado: true, dataDeDemonstracao: DATA_SIMULADA });
  });
});
