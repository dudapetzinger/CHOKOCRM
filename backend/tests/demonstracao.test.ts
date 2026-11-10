import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import * as seedDemonstracao from '../src/seed/demonstracao';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { ativarDataDeDemonstracao, DATA_SIMULADA, deslocamentoEsperado } from './helpers/data-de-demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * `POST /sistema/demonstracao` (público, chamado da tela de login): confere
 * e-mail e senha da conta Gestão, grava a data da demonstração (ou a limpa,
 * com `null`) na tabela `configuracoes` e recria a demonstração com
 * `reiniciarDemonstracao` na data nova, uma recriação por vez.
 */
const SENHA = 'senha-do-escritorio';
const EMAIL_GESTOR = 'gestao.demonstracao-teste@chokolaten.com.br';
const EMAIL_REP = 'eduarda.demonstracao-teste@chokolaten.com.br';
// A recriação de verdade (26 clientes, visitas, pedidos, bcrypt das contas) passa de 15 s sob carga.
const PRAZO_DA_RECRIACAO_MS = 90_000;

let gestorId: string;

function postDemonstracao(corpo: { data: string | null; email: string; senha: string }) {
  return request(app).post('/sistema/demonstracao').send(corpo);
}

async function relogioPublico(): Promise<Record<string, unknown>> {
  return (await request(app).get('/sistema/relogio')).body;
}

async function linhaDaConfiguracao() {
  return prisma.configuracao.findUnique({ where: { chave: 'demonstracao' } });
}

/** Dia (São Paulo) da visita mais recente do banco. */
async function diaDaVisitaMaisRecente(): Promise<string> {
  const visita = await prisma.visit.findFirstOrThrow({ orderBy: { dataHora: 'desc' } });
  return dataCalendario(visita.dataHora);
}

beforeEach(async () => {
  await truncateAllTables();
  const senhaHash = await bcrypt.hash(SENHA, 4);
  const gestor = await prisma.user.create({
    data: { nome: 'Gestão de teste', email: EMAIL_GESTOR, role: 'GESTOR', senhaHash },
  });
  gestorId = gestor.id;
  await prisma.user.create({ data: { nome: 'Eduarda Fischer', email: EMAIL_REP, role: 'REPRESENTANTE', senhaHash } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('POST /sistema/demonstracao — autenticação', () => {
  it('e-mail desconhecido responde 401 e não muda nada', async () => {
    const espiao = jest.spyOn(seedDemonstracao, 'reiniciarDemonstracao');

    const res = await postDemonstracao({ data: DATA_SIMULADA, email: 'ninguem@chokolaten.com.br', senha: SENHA });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
    expect(espiao).not.toHaveBeenCalled();
    expect(await linhaDaConfiguracao()).toBeNull();
    expect((await relogioPublico()).simulado).toBe(false);
  });

  it('senha errada responde 401', async () => {
    const res = await postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: 'errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
    expect(await linhaDaConfiguracao()).toBeNull();
  });

  it('representante responde 403', async () => {
    const espiao = jest.spyOn(seedDemonstracao, 'reiniciarDemonstracao');

    const res = await postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_REP, senha: SENHA });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Só a conta Gestão pode fazer isso.');
    expect(espiao).not.toHaveBeenCalled();
    expect(await linhaDaConfiguracao()).toBeNull();
  });

  it('conta Gestão inativa responde 403', async () => {
    await prisma.user.update({ where: { id: gestorId }, data: { ativo: false } });

    const res = await postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: SENHA });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('Só a conta Gestão pode fazer isso.');
  });

  it.each([
    { data: '2027-02-30', email: EMAIL_GESTOR, senha: SENHA },
    { data: '15/03/2027', email: EMAIL_GESTOR, senha: SENHA },
    { email: EMAIL_GESTOR, senha: SENHA },
    { data: DATA_SIMULADA, email: 'nao-e-email', senha: SENHA },
    { data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: '' },
  ])('corpo inválido %j responde 400', async (corpo) => {
    const res = await request(app).post('/sistema/demonstracao').send(corpo);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /sistema/demonstracao — recriação', () => {
  it(
    'gestão + data: grava a configuração, recria a demonstração na data e responde { relogio }',
    async () => {
      const res = await postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: SENHA });

      expect(res.status).toBe(200);
      const hojeReal = dataCalendario(new Date());
      expect(res.body).toEqual({
        relogio: {
          agora: expect.any(String),
          simulado: true,
          dataDeDemonstracao: DATA_SIMULADA,
          diaDeReferencia: hojeReal,
          deslocamentoDias: deslocamentoEsperado(),
        },
      });
      expect(dataCalendario(new Date(res.body.relogio.agora))).toBe(DATA_SIMULADA);

      const linha = await linhaDaConfiguracao();
      expect(linha).toMatchObject({ atualizadoPor: gestorId });
      expect(linha?.dataSimulada?.toISOString().slice(0, 10)).toBe(DATA_SIMULADA);
      expect(linha?.diaDeReferencia?.toISOString().slice(0, 10)).toBe(hojeReal);

      // O GET público reflete a data nova
      expect(await relogioPublico()).toMatchObject({ simulado: true, dataDeDemonstracao: DATA_SIMULADA });

      // A demonstração renasceu em março de 2027, e as contas foram mantidas
      expect(await prisma.client.count()).toBe(26);
      const maisRecente = await diaDaVisitaMaisRecente();
      expect(maisRecente.slice(0, 7)).toBe('2027-03');
      expect(maisRecente <= DATA_SIMULADA).toBe(true);
      expect(await prisma.user.count({ where: { id: gestorId } })).toBe(1);
    },
    PRAZO_DA_RECRIACAO_MS,
  );

  it(
    'data null desliga o modo demonstração e recria a demonstração hoje',
    async () => {
      await ativarDataDeDemonstracao();

      const res = await postDemonstracao({ data: null, email: EMAIL_GESTOR, senha: SENHA });

      expect(res.status).toBe(200);
      expect(res.body.relogio).toMatchObject({
        simulado: false,
        dataDeDemonstracao: null,
        diaDeReferencia: null,
        deslocamentoDias: 0,
      });
      expect(await relogioPublico()).toMatchObject({ simulado: false, deslocamentoDias: 0 });
      expect(await linhaDaConfiguracao()).toMatchObject({ dataSimulada: null, diaDeReferencia: null });

      expect(await prisma.client.count()).toBe(26);
      const hojeReal = dataCalendario(new Date());
      const maisRecente = await diaDaVisitaMaisRecente();
      expect(maisRecente <= hojeReal).toBe(true);
      expect(maisRecente >= somarDias(hojeReal, -30)).toBe(true);
    },
    PRAZO_DA_RECRIACAO_MS,
  );

  it('uma segunda chamada durante a recriação responde 409, sem segunda gravação nem transação', async () => {
    let terminarRecriacao: () => void = () => undefined;
    const recriacaoPendente = new Promise<void>((resolve) => {
      terminarRecriacao = resolve;
    });
    const espiao = jest.spyOn(seedDemonstracao, 'reiniciarDemonstracao').mockReturnValue(recriacaoPendente);

    const primeira = postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: SENHA }).then((r) => r);
    while (espiao.mock.calls.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    const segunda = await postDemonstracao({ data: '2027-04-01', email: EMAIL_GESTOR, senha: SENHA });

    expect(segunda.status).toBe(409);
    expect(segunda.body.error.message).toBe('Já existe uma recriação em andamento.');
    terminarRecriacao();
    expect((await primeira).status).toBe(200);
    expect(espiao).toHaveBeenCalledTimes(1);
    expect(await relogioPublico()).toMatchObject({ dataDeDemonstracao: DATA_SIMULADA });
  });

  it('se a recriação falha com o relógio real antes, responde 500, continua real e libera a próxima', async () => {
    const espiao = jest
      .spyOn(seedDemonstracao, 'reiniciarDemonstracao')
      .mockRejectedValueOnce(new Error('falha simulada no seed'))
      .mockResolvedValue(undefined);

    const falhou = await postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: SENHA });

    expect(falhou.status).toBe(500);
    expect(await relogioPublico()).toMatchObject({
      simulado: false,
      dataDeDemonstracao: null,
      diaDeReferencia: null,
      deslocamentoDias: 0,
    });
    // Não havia linha: a restauração a apaga
    expect(await linhaDaConfiguracao()).toBeNull();

    const depois = await postDemonstracao({ data: DATA_SIMULADA, email: EMAIL_GESTOR, senha: SENHA });
    expect(depois.status).toBe(200);
    expect(await relogioPublico()).toMatchObject({ simulado: true, dataDeDemonstracao: DATA_SIMULADA });
    expect(espiao).toHaveBeenCalledTimes(2);
  });

  it('se a recriação falha com 2027-03-15 antes, responde 500 e a linha volta como estava', async () => {
    await ativarDataDeDemonstracao();
    await prisma.configuracao.update({ where: { chave: 'demonstracao' }, data: { atualizadoPor: 'quem-ligou-antes' } });
    const antes = await relogioPublico();
    jest
      .spyOn(seedDemonstracao, 'reiniciarDemonstracao')
      .mockRejectedValueOnce(new Error('falha simulada no seed'))
      .mockResolvedValue(undefined);

    const falhou = await postDemonstracao({ data: '2027-06-01', email: EMAIL_GESTOR, senha: SENHA });

    expect(falhou.status).toBe(500);
    const depoisDaFalha = await relogioPublico();
    expect(depoisDaFalha).toMatchObject({
      simulado: true,
      dataDeDemonstracao: DATA_SIMULADA,
      diaDeReferencia: antes.diaDeReferencia,
      deslocamentoDias: antes.deslocamentoDias,
    });
    const linha = await linhaDaConfiguracao();
    expect(linha?.dataSimulada?.toISOString().slice(0, 10)).toBe(DATA_SIMULADA);
    expect(linha?.diaDeReferencia?.toISOString().slice(0, 10)).toBe(antes.diaDeReferencia);
    expect(linha?.atualizadoPor).toBe('quem-ligou-antes');

    const depois = await postDemonstracao({ data: null, email: EMAIL_GESTOR, senha: SENHA });
    expect(depois.status).toBe(200);
    expect(await relogioPublico()).toMatchObject({ simulado: false });
  });
});

describe('login com o modo demonstração ligado', () => {
  it('o token emitido pelo relógio real vale em GET /auth/me (Review Focus 1)', async () => {
    await ativarDataDeDemonstracao();

    const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTOR, senha: SENHA });
    expect(login.status).toBe(200);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ id: gestorId, role: 'GESTOR' });
  });
});
