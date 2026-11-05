// Primeiro import: liga DATA_DE_DEMONSTRACAO antes de config/env e lib/relogio.
import { DATA_SIMULADA, deslocamentoEsperado } from './helpers/data-de-demonstracao';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { executarAgendaDiaria } from '../src/jobs/agendaDiaria.job';
import { executarLimpezaDeFotos } from '../src/jobs/limpezaDeFotos.job';
import { prisma } from '../src/lib/prisma';
import { agora, dataDeDemonstracao, deslocamentoDias, simulado } from '../src/lib/relogio';
import { reiniciarDemonstracao } from '../src/seed/demonstracao';
import * as agendaService from '../src/services/agenda.service';
import { dataCalendario, inicioDoDia, somarDias } from '../src/services/classificacao.service';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import { fileStorage } from '../src/storage';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

/**
 * Comportamento de ponta a ponta com o relógio de demonstração ligado
 * (`DATA_DE_DEMONSTRACAO=2027-03-15`): seed, cadastro de cliente, check-in,
 * virada da meia-noite, importação de notas, jobs e campanhas vivem na data
 * simulada, não na real.
 *
 * O deslocamento é calculado na carga de `lib/relogio.ts` contra o dia real;
 * o relógio falso (`fixarRelogio`) é posto no dia real da carga
 * (`DATA_SIMULADA - deslocamentoDias()`), para `agora()` cair exatamente em
 * `DATA_SIMULADA` em qualquer dia em que a suíte rode.
 */

// O extrator de PDF (pdf.js num worker) é trocado pelas linhas do fixture da NF 2455.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);

const SENHA = 'chokocrm123';
const EMAIL_REP = 'eduarda.relogio-teste@chokolaten.com.br';
const EMAIL_GESTOR = 'ricardo.relogio-teste@chokolaten.com.br';
const MILISSEGUNDOS_POR_DIA = 86_400_000;
const MILISSEGUNDOS_POR_MINUTO = 60_000;

/** Dia real (São Paulo) em que `lib/relogio.ts` calculou o deslocamento. */
const DIA_REAL = somarDias(DATA_SIMULADA, -deslocamentoDias());

/** Instante no dia real da carga, `minutos` depois da meia-noite de São Paulo. */
function noDiaReal(minutos: number): Date {
  return new Date(inicioDoDia(DIA_REAL).getTime() + minutos * MILISSEGUNDOS_POR_MINUTO);
}

const MEIO_DIA = 12 * 60;

let representanteId: string;

async function logar(email: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, senha: SENHA });
  return res.body.token;
}

async function criarClienteNoBanco(nomeFantasia: string, cnpj: string, recorrenciaDias = 15): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Boa Vista, 80',
      telefone: '(47) 3387-5820',
      email: 'contato@exemplo.com.br',
      representanteId,
      recorrenciaDias,
      criadoEm: new Date(agora().getTime() - 200 * MILISSEGUNDOS_POR_DIA),
    },
  });
  return cliente.id;
}

beforeAll(() => {
  // Antes de fixar o relógio: deslocamentoEsperado() lê o dia real.
  expect(deslocamentoDias()).toBe(deslocamentoEsperado());
});

beforeEach(async () => {
  fixarRelogio(noDiaReal(MEIO_DIA));
  await truncateAllTables();
  extrairMock.mockReset();
  extrairMock.mockResolvedValue([{ numero: 1, linhas: LINHAS_NF_2455 }]);

  const senhaHash = await bcrypt.hash(SENHA, 4);
  const rep = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', email: EMAIL_REP, role: 'REPRESENTANTE', senhaHash },
  });
  representanteId = rep.id;
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', email: EMAIL_GESTOR, role: 'GESTOR', senhaHash },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  liberarRelogio();
  await prisma.$disconnect();
});

describe('relógio de demonstração ligado (DATA_DE_DEMONSTRACAO=2027-03-15)', () => {
  it('agora() cai na data simulada', () => {
    expect(simulado()).toBe(true);
    expect(dataDeDemonstracao()).toBe(DATA_SIMULADA);
    expect(dataCalendario(agora())).toBe(DATA_SIMULADA);
  });

  it('o seed renasce em volta da data simulada', async () => {
    await reiniciarDemonstracao(prisma, agora());

    const anos = new Set(
      (await prisma.seasonalEvent.findMany({ select: { nome: true } })).map((e) => e.nome.slice(-4)),
    );
    expect([...anos].sort()).toEqual(['2027', '2028']);

    const dias = (await prisma.visit.findMany({ select: { dataHora: true }, orderBy: { dataHora: 'desc' } })).map(
      (v) => dataCalendario(v.dataHora),
    );
    expect(dias.length).toBeGreaterThan(0);
    const maisRecente = dias[0] ?? '';
    expect(maisRecente.slice(0, 7)).toBe('2027-03');
    expect(maisRecente <= DATA_SIMULADA).toBe(true);
    // Nenhuma visita no "futuro real" além do dia simulado, e o histórico
    // inteiro fica dentro de um ano antes da data simulada.
    const maisAntiga = dias[dias.length - 1] ?? '';
    expect(maisAntiga >= somarDias(DATA_SIMULADA, -366)).toBe(true);

    // Cliente nunca visitado: a base da primeira visita é o dia simulado.
    const indaial = await prisma.client.findUniqueOrThrow({ where: { cnpj: '20952813000199' } });
    expect(dataCalendario(indaial.criadoEm)).toBe(DATA_SIMULADA);
  });

  it('prisma/seed.ts passa agora() como hoje para o seed', () => {
    const fonte = readFileSync(join(__dirname, '..', 'prisma', 'seed.ts'), 'utf8');
    expect(fonte).toMatch(/const hoje = agora\(\);/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });

  it('cliente criado pelo app nasce com criadoEm na data simulada', async () => {
    const token = await logar(EMAIL_REP);
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razaoSocial: 'Mercado Central Joinville Comércio de Alimentos Ltda',
        nomeFantasia: 'Mercado Central Joinville',
        cnpj: '11222333000424',
        cidade: 'Joinville',
        endereco: 'Rua do Príncipe, 800 - Centro, Joinville/SC',
        telefone: '(47) 3433-3030',
        email: 'contato@mercadocentraljoinville.com.br',
        contatos: [
          {
            nome: 'Roberto Alves',
            cargo: 'Gerente de Compras',
            telefone: '(47) 99955-3030',
            email: 'roberto.alves@mercadocentraljoinville.com.br',
            principal: true,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(dataCalendario(new Date(res.body.criadoEm))).toBe(DATA_SIMULADA);

    const agenda = await request(app).get('/agenda/today').set('Authorization', `Bearer ${token}`);
    expect(agenda.status).toBe(200);
    const ids = (lista: { id: string }[]) => lista.map((item) => item.id);
    expect(ids(agenda.body.data.atrasadas)).not.toContain(res.body.id);
    expect(ids(agenda.body.data.hoje)).not.toContain(res.body.id);
  });

  it('check-in gravado agora cai em "hoje" simulado e a cor é VERDE', async () => {
    const clienteId = await criarClienteNoBanco('Empório Pomerode', '25382906000149', 7);
    await prisma.visit.create({
      data: {
        clientId: clienteId,
        userId: representanteId,
        dataHora: new Date(agora().getTime() - 7 * MILISSEGUNDOS_POR_DIA),
        descricao: 'Visita de uma semana atrás',
        resultado: 'NEGOCIACAO',
      },
    });
    const token = await logar(EMAIL_REP);

    // Recorrência semanal e última visita há 7 dias simulados: é a agenda de hoje.
    const antes = await request(app).get('/agenda/today').set('Authorization', `Bearer ${token}`);
    expect(antes.body.data.hoje.map((i: { id: string }) => i.id)).toEqual([clienteId]);

    const checkIn = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Reposição do mostruário e pedido de trufas.', resultado: 'VENDA' });
    expect(checkIn.status).toBe(201);
    expect(dataCalendario(new Date(checkIn.body.dataHora))).toBe(DATA_SIMULADA);

    const lista = await request(app).get('/clients').set('Authorization', `Bearer ${token}`);
    const cliente = lista.body.data.find((c: { id: string }) => c.id === clienteId);
    expect(cliente).toMatchObject({ cor: 'VERDE', diasSemVisita: 0 });

    const depois = await request(app).get('/agenda/today').set('Authorization', `Bearer ${token}`);
    expect(depois.body.data.hoje).toEqual([]);
    expect(depois.body.data.atrasadas).toEqual([]);
  });

  it('visita às 23h50 de São Paulo conta como o dia simulado, não o real', async () => {
    const clienteId = await criarClienteNoBanco('Empório Pomerode', '25382906000149');

    fixarRelogio(noDiaReal(23 * 60 + 50));
    expect(dataCalendario(agora())).toBe(DATA_SIMULADA);
    const token = await logar(EMAIL_REP);
    const checkIn = await request(app)
      .post(`/clients/${clienteId}/visits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descricao: 'Visita no fim do dia.', resultado: 'VENDA' });
    expect(checkIn.status).toBe(201);
    expect(dataCalendario(new Date(checkIn.body.dataHora))).toBe(DATA_SIMULADA);
    const naHora = await request(app).get(`/clients/${clienteId}`).set('Authorization', `Bearer ${token}`);
    expect(naHora.body).toMatchObject({ cor: 'VERDE', diasSemVisita: 0 });

    // 00h10 do dia seguinte: o "hoje" é o dia simulado seguinte, e a visita é de ontem.
    fixarRelogio(noDiaReal(24 * 60 + 10));
    expect(dataCalendario(agora())).toBe(somarDias(DATA_SIMULADA, 1));
    const tokenDepois = await logar(EMAIL_REP);
    const depois = await request(app).get(`/clients/${clienteId}`).set('Authorization', `Bearer ${tokenDepois}`);
    expect(depois.body).toMatchObject({ cor: 'VERDE', diasSemVisita: 1 });
  });

  it('importação grava criadoEm na data simulada', async () => {
    const token = await logar(EMAIL_GESTOR);
    const res = await request(app)
      .post('/erp/importacoes?nome=notas.pdf')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4 simulado'));

    expect(res.status).toBe(201);
    expect(dataCalendario(new Date(res.body.criadoEm))).toBe(DATA_SIMULADA);
    const importacao = await prisma.erpImport.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(dataCalendario(importacao.criadoEm)).toBe(DATA_SIMULADA);
  });

  it('a agenda diária, sem argumento, calcula o dia simulado', async () => {
    const espiao = jest.spyOn(agendaService, 'getAgendaDoDia');

    await executarAgendaDiaria();

    expect(espiao).toHaveBeenCalledTimes(1);
    const hojeUsado = espiao.mock.calls[0]?.[1];
    expect(hojeUsado).toBeInstanceOf(Date);
    expect(dataCalendario(hojeUsado as Date)).toBe(DATA_SIMULADA);
  });

  it('a limpeza de fotos, sem argumento, conta a retenção a partir do dia simulado', async () => {
    const apagar = jest.spyOn(fileStorage, 'delete').mockResolvedValue(undefined);
    const clienteId = await criarClienteNoBanco('Empório Pomerode', '25382906000149');
    const visitaComFoto = (dias: number, fotoPath: string) =>
      prisma.visit.create({
        data: {
          clientId: clienteId,
          userId: representanteId,
          dataHora: new Date(agora().getTime() - dias * MILISSEGUNDOS_POR_DIA),
          descricao: `Visita há ${dias} dias simulados`,
          resultado: 'NEGOCIACAO',
          fotoPath,
        },
      });
    const antiga = await visitaComFoto(env.FOTOS_RETENCAO_DIAS + 10, 'antiga.jpg');
    const recente = await visitaComFoto(env.FOTOS_RETENCAO_DIAS - 10, 'recente.jpg');

    const resultado = await executarLimpezaDeFotos();

    expect(resultado).toEqual({ apagadas: 1, falhas: 0 });
    expect(apagar).toHaveBeenCalledWith('antiga.jpg');
    const antigaDepois = await prisma.visit.findUniqueOrThrow({ where: { id: antiga.id } });
    expect(antigaDepois.fotoPath).toBeNull();
    expect(dataCalendario(antigaDepois.fotoApagadaEm as Date)).toBe(DATA_SIMULADA);
    const recenteDepois = await prisma.visit.findUniqueOrThrow({ where: { id: recente.id } });
    expect(recenteDepois.fotoPath).toBe('recente.jpg');
  });

  it('campanha vigente na data simulada aparece como em andamento', async () => {
    const token = await logar(EMAIL_GESTOR);
    const criada = await request(app)
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Páscoa Chokolaten', tipo: 'CAMPANHA', inicio: '2027-03-01', fim: '2027-03-31' });
    expect(criada.status).toBe(201);
    expect(criada.body.status).toBe('EM_ANDAMENTO');

    const lista = await request(app).get('/campaigns').set('Authorization', `Bearer ${token}`);
    expect(lista.body.data.map((c: { nome: string; status: string }) => [c.nome, c.status])).toEqual([
      ['Páscoa Chokolaten', 'EM_ANDAMENTO'],
    ]);
  });
});
