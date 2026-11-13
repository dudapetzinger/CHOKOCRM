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
import {
  ativarDataDeDemonstracao,
  DATA_SIMULADA,
  desativarDataDeDemonstracao,
  deslocamentoEsperado,
} from './helpers/data-de-demonstracao';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

/**
 * Comportamento de ponta a ponta com o modo demonstração ligado (data
 * 2027-03-15 na tabela `configuracoes`): seed, cadastro de cliente, check-in,
 * virada da meia-noite, importação de notas, jobs e campanhas vivem na data
 * simulada, não na real.
 *
 * Cada caso fixa o relógio falso (`fixarRelogio`) ao meio-dia do dia real de
 * hoje, trunca o banco (o que volta o relógio ao real) e liga a data com
 * `ativarDataDeDemonstracao`: a referência gravada é o dia real, então
 * `agora()` cai exatamente em `DATA_SIMULADA` em qualquer dia em que a suíte
 * rode.
 */

// O extrator de PDF (pdf.js num worker) é trocado pelas linhas do fixture da NF 2455.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);

const SENHA = 'chokocrm123';
const USUARIO_REP = 'eduarda.relogio-teste';
const USUARIO_GESTOR = 'ricardo.relogio-teste';
const MILISSEGUNDOS_POR_DIA = 86_400_000;
const MILISSEGUNDOS_POR_MINUTO = 60_000;

/** Dia real (São Paulo) em que a suíte roda: a referência gravada ao ligar a data. */
const DIA_REAL = dataCalendario(new Date());

/** Instante no dia real da carga, `minutos` depois da meia-noite de São Paulo. */
function noDiaReal(minutos: number): Date {
  return new Date(inicioDoDia(DIA_REAL).getTime() + minutos * MILISSEGUNDOS_POR_MINUTO);
}

const MEIO_DIA = 12 * 60;

let representanteId: string;

async function logar(usuario: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ usuario, senha: SENHA });
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

beforeEach(async () => {
  fixarRelogio(noDiaReal(MEIO_DIA));
  await truncateAllTables();
  await ativarDataDeDemonstracao();
  expect(deslocamentoDias()).toBe(deslocamentoEsperado());
  extrairMock.mockReset();
  extrairMock.mockResolvedValue([{ numero: 1, linhas: LINHAS_NF_2455 }]);

  const senhaHash = await bcrypt.hash(SENHA, 4);
  const rep = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', usuario: USUARIO_REP, role: 'REPRESENTANTE', senhaHash },
  });
  representanteId = rep.id;
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', usuario: USUARIO_GESTOR, role: 'GESTOR', senhaHash },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  liberarRelogio();
  await desativarDataDeDemonstracao();
  await prisma.$disconnect();
});

describe('modo demonstração ligado (2027-03-15)', () => {
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
    // são as 13 semanas até a data simulada (desde a segunda-feira de 12
    // semanas antes), só em dias úteis.
    const maisAntiga = dias[dias.length - 1] ?? '';
    expect(maisAntiga).toBe(somarDias(DATA_SIMULADA, -84));
    expect(dias.every((dia) => ![0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay()))).toBe(true);

    // Cliente nunca visitado: a base da primeira visita é o dia simulado.
    const indaial = await prisma.client.findUniqueOrThrow({ where: { cnpj: '20952813000199' } });
    expect(dataCalendario(indaial.criadoEm)).toBe(DATA_SIMULADA);
  });

  it('as visitas marcadas acompanham a janela da data simulada: agenda de hoje e calendário cheios', async () => {
    await reiniciarDemonstracao(prisma, agora());
    const fimDaJanela = somarDias(DATA_SIMULADA, 23);
    const diasUteis: string[] = [];
    for (let dia = DATA_SIMULADA; dia <= fimDaJanela; dia = somarDias(dia, 1)) {
      if (![0, 6].includes(new Date(`${dia}T12:00:00Z`).getUTCDay())) diasUteis.push(dia);
    }
    expect(diasUteis).toHaveLength(18);

    for (const usuario of ['eduarda', 'rafael']) {
      const token = await logar(usuario);
      const agenda = await request(app).get('/agenda/today').set('Authorization', `Bearer ${token}`);
      expect(agenda.status).toBe(200);
      const marcadasHoje = (agenda.body.data.hoje as { proximaVisita: string; marcadaNoCheckIn: boolean }[]).filter(
        (item) => item.marcadaNoCheckIn && item.proximaVisita === DATA_SIMULADA,
      );
      expect(marcadasHoje.length).toBeGreaterThanOrEqual(2);

      const itens: { data: string; tipo: string }[] = [];
      for (const mes of ['2027-03', '2027-04']) {
        const calendario = await request(app)
          .get(`/agenda/calendario?mes=${mes}`)
          .set('Authorization', `Bearer ${token}`);
        expect(calendario.status).toBe(200);
        itens.push(...calendario.body.data.itens);
      }
      for (const dia of diasUteis) {
        expect(itens.filter((item) => item.tipo === 'VISITA' && item.data === dia).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('as visitas marcadas da janela não tiram ninguém da agenda de hoje e tiram no máximo 3 da de amanhã', async () => {
    await reiniciarDemonstracao(prisma, agora());
    const amanha = new Date(agora().getTime() + MILISSEGUNDOS_POR_DIA);
    const representantes = await prisma.user.findMany({
      where: { usuario: { in: ['eduarda', 'rafael'] } },
    });
    const nomesDoDia = async (usuario: { id: string }, instante: Date): Promise<string[]> =>
      (await agendaService.getAgendaDoDia({ id: usuario.id, role: 'REPRESENTANTE' }, instante)).hoje
        .map((item) => item.nomeFantasia)
        .sort();

    const comMarcacoes = new Map<string, { hoje: string[]; amanha: string[] }>();
    for (const usuario of representantes) {
      comMarcacoes.set(usuario.id, {
        hoje: await nomesDoDia(usuario, agora()),
        amanha: await nomesDoDia(usuario, amanha),
      });
    }
    // Sem as marcações da janela: só ficam os três casos de propósito.
    await prisma.client.updateMany({
      where: {
        email: {
          notIn: ['contato@doceriajaragua.com.br', 'contato@cafeblumenau.com.br', 'contato@emporiodovalebrusque.com.br'],
        },
      },
      data: { proximaVisita: null, proximaCampanhaId: null },
    });

    for (const usuario of representantes) {
      const com = comMarcacoes.get(usuario.id) as { hoje: string[]; amanha: string[] };
      const semHoje = await nomesDoDia(usuario, agora());
      const semAmanha = await nomesDoDia(usuario, amanha);
      // Hoje: ninguém sai (quem entra é antecipado da janela para hoje).
      expect(semHoje.filter((nome) => !com.hoje.includes(nome))).toEqual([]);
      // Amanhã: no máximo 3 adiados (último recurso da escolha).
      expect(semAmanha.filter((nome) => !com.amanha.includes(nome)).length).toBeLessThanOrEqual(3);
    }
  });

  it('prisma/seed.ts carrega o relógio do banco e passa agora() como hoje para o seed', () => {
    const fonte = readFileSync(join(__dirname, '..', 'prisma', 'seed.ts'), 'utf8');
    expect(fonte).toMatch(/await carregarRelogio\(\);\s+const hoje = agora\(\);/);
    expect(fonte).not.toMatch(/new Date\(|Date\.now\(/);
  });

  it('cliente criado pela nota fiscal nasce com criadoEm na data simulada', async () => {
    const tokenGestor = await logar(USUARIO_GESTOR);
    const importacao = await request(app)
      .post('/erp/importacoes?nome=notas.pdf')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4 simulado'));
    expect(importacao.status).toBe(201);

    const res = await request(app)
      .post('/erp/sem-cliente/25382906000149/cliente')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ representanteId });

    expect(res.status).toBe(201);
    expect(dataCalendario(new Date(res.body.criadoEm))).toBe(DATA_SIMULADA);

    const token = await logar(USUARIO_REP);
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
    const token = await logar(USUARIO_REP);

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
    const token = await logar(USUARIO_REP);
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
    const tokenDepois = await logar(USUARIO_REP);
    const depois = await request(app).get(`/clients/${clienteId}`).set('Authorization', `Bearer ${tokenDepois}`);
    expect(depois.body).toMatchObject({ cor: 'VERDE', diasSemVisita: 1 });
  });

  it('importação grava criadoEm na data simulada', async () => {
    const token = await logar(USUARIO_GESTOR);
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
    const token = await logar(USUARIO_GESTOR);
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
