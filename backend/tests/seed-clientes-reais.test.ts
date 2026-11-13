import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import {
  CLIENTES_ANCORA,
  CLIENTES_GERADOS,
  cnpjsDaDemonstracao,
  USUARIO_GESTAO,
  reiniciarDemonstracao,
  SENHA_DEMONSTRACAO,
} from '../src/seed/demonstracao';
import { ativarDataDeDemonstracao } from './helpers/data-de-demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * Clientes reais no reset: `reiniciarDemonstracao` apaga e recria só os
 * clientes da demonstração (CNPJ em `CLIENTES`); o cliente real (cadastrado à
 * mão ou criado pela nota fiscal) sobrevive com contatos, visitas (itens),
 * lembretes, mudanças de recorrência e notas vinculadas.
 * Metas e campanhas continuam apagadas para todos: a visita do cliente real
 * que era de uma campanha da demonstração fica sem campanha.
 */

// O extrator do PDF (pdf.js num worker) é trocado pelas linhas do fixture, como em seed-hibrido.test.ts.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);

// CNPJ da DANFE do fixture: a parceira real, que nenhum cliente do seed usa.
const CNPJ_NF = '25382906000149';
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);
/** Cliente real cadastrado à mão, fora do seed. */
const CNPJ_REAL = '99888777000155';
/** Clientes da demonstração: os âncoras e os gerados. */
const CLIENTES_DA_DEMONSTRACAO = CLIENTES_ANCORA.length + CLIENTES_GERADOS.length;
/** Segunda-feira, 12:00 em São Paulo: dia útil, longe da virada do dia. */
const DATA = '2026-10-19';
const HOJE = new Date(`${DATA}T15:00:00.000Z`);
// Cada recriação grava ~80 clientes, visitas e pedidos numa transação.
const PRAZO_MS = 240_000;

async function tokenDaGestao(): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario: USUARIO_GESTAO, senha: SENHA_DEMONSTRACAO });
  return login.body.token as string;
}

async function totais() {
  return {
    clientes: await prisma.client.count(),
    contatos: await prisma.contact.count(),
    visitas: await prisma.visit.count(),
    itens: await prisma.visitItem.count(),
    lembretes: await prisma.reminder.count(),
    mudancas: await prisma.visitScheduleChange.count(),
    campanhas: await prisma.campaign.count(),
    metas: await prisma.goal.count(),
    notas: await prisma.erpSale.count(),
  };
}

/** Cliente real com contato, visita de venda (2 itens, campanha atual), lembrete aberto e mudança de recorrência. */
async function criarClienteReal() {
  const representante = await prisma.user.findUniqueOrThrow({ where: { usuario: 'eduarda' } });
  const campanha = await prisma.campaign.findFirstOrThrow({
    where: { inicio: { lte: HOJE }, fim: { gte: new Date(`${DATA}T00:00:00.000Z`) } },
  });
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Loja da Joana Ltda',
      nomeFantasia: 'Loja da Joana',
      cnpj: CNPJ_REAL,
      cidade: 'Gaspar',
      endereco: 'Rua Itajaí, 10 - Centro, Gaspar/SC',
      telefone: '(47) 3333-0000',
      email: 'contato@lojadajoana.com.br',
      representanteId: representante.id,
    },
  });
  const contato = await prisma.contact.create({
    data: {
      clientId: cliente.id,
      nome: 'Joana Silva',
      cargo: 'Proprietária',
      telefone: '(47) 98888-0000',
      email: 'joana@lojadajoana.com.br',
      principal: true,
    },
  });
  const visita = await prisma.visit.create({
    data: {
      clientId: cliente.id,
      userId: representante.id,
      contactId: contato.id,
      dataHora: HOJE,
      descricao: 'Pedido para a vitrine.',
      resultado: 'VENDA',
      campanhaId: campanha.id,
      itens: {
        create: [
          { sku: 'SKU-A', produtoNome: 'Produto A', quantidade: 2, precoUnitario: 10 },
          { sku: 'SKU-B', produtoNome: 'Produto B', quantidade: 3, precoUnitario: 20 },
        ],
      },
    },
  });
  const lembrete = await prisma.reminder.create({
    data: {
      clientId: cliente.id,
      criadoPorId: representante.id,
      visitId: visita.id,
      texto: 'Levar o catálogo novo.',
      data: new Date(`${DATA}T00:00:00.000Z`),
    },
  });
  const mudanca = await prisma.visitScheduleChange.create({
    data: {
      clientId: cliente.id,
      userId: representante.id,
      recorrenciaAnterior: 15,
      recorrenciaNova: 30,
      justificativa: 'Compra mensal.',
      data: HOJE,
    },
  });
  return { cliente, contato, visita, lembrete, mudanca };
}

beforeEach(async () => {
  await truncateAllTables();
  await ativarDataDeDemonstracao(DATA);
  await reiniciarDemonstracao(prisma, HOJE);
}, PRAZO_MS);

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('clientes reais no reset da demonstração', () => {
  it('cnpjsDaDemonstracao tem os CNPJs de todos os clientes do seed, e só eles', () => {
    const cnpjs = cnpjsDaDemonstracao();
    expect(cnpjs.size).toBe(CLIENTES_DA_DEMONSTRACAO);
    expect(cnpjs.has(CLIENTES_ANCORA[0]?.cnpj ?? '')).toBe(true);
    expect(cnpjs.has(CNPJ_REAL)).toBe(false);
    expect(cnpjs.has(CNPJ_NF)).toBe(false);
  });

  it(
    'cliente real cadastrado à mão sobrevive com contato, visita (itens), lembrete e mudança de recorrência; a visita perde a campanha',
    async () => {
      const real = await criarClienteReal();

      await reiniciarDemonstracao(prisma, HOJE);

      expect(CLIENTES_DA_DEMONSTRACAO).toBe(80);
      expect(await prisma.client.count()).toBe(80 + 1);
      const cliente = await prisma.client.findUniqueOrThrow({ where: { cnpj: CNPJ_REAL } });
      expect(cliente.id).toBe(real.cliente.id);
      expect(await prisma.contact.findUnique({ where: { id: real.contato.id } })).not.toBeNull();
      const visita = await prisma.visit.findUniqueOrThrow({ where: { id: real.visita.id }, include: { itens: true } });
      expect(visita.campanhaId).toBeNull();
      expect(visita.contactId).toBe(real.contato.id);
      expect(visita.itens).toHaveLength(2);
      const lembrete = await prisma.reminder.findUniqueOrThrow({ where: { id: real.lembrete.id } });
      expect(lembrete.concluidoEm).toBeNull();
      expect(lembrete.visitId).toBe(real.visita.id);
      expect(await prisma.visitScheduleChange.findUnique({ where: { id: real.mudanca.id } })).not.toBeNull();
    },
    PRAZO_MS,
  );

  it(
    'cliente criado pela nota importada sobrevive, a nota continua dele com o mesmo vínculo e não volta a "CNPJs sem cliente"',
    async () => {
      const token = await tokenDaGestao();
      extrairMock.mockResolvedValue([{ numero: 1, linhas: LINHAS_NF_2455 }]);
      const importada = await request(app)
        .post('/erp/importacoes?nome=notas.pdf')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 simulado'));
      expect(importada.status).toBe(201);
      const representante = await prisma.user.findUniqueOrThrow({ where: { usuario: 'eduarda' } });
      const criado = await request(app)
        .post(`/erp/sem-cliente/${CNPJ_NF}/cliente`)
        .set('Authorization', `Bearer ${token}`)
        .send({ representanteId: representante.id });
      expect(criado.status).toBe(201);
      const antes = await prisma.erpSale.findFirstOrThrow({ where: { destinatarioCnpj: CNPJ_NF } });
      expect(antes.clientId).toBe(criado.body.id);

      await reiniciarDemonstracao(prisma, HOJE);

      const cliente = await prisma.client.findUniqueOrThrow({ where: { cnpj: CNPJ_NF } });
      expect(cliente.id).toBe(criado.body.id);
      const nota = await prisma.erpSale.findUniqueOrThrow({ where: { id: antes.id } });
      expect(nota.clientId).toBe(cliente.id);
      expect(nota.vinculoStatus).toBe(antes.vinculoStatus);
      const semCliente = await request(app).get('/erp/sem-cliente').set('Authorization', `Bearer ${await tokenDaGestao()}`);
      expect(semCliente.status).toBe(200);
      expect(semCliente.body.data).toEqual([]);
    },
    PRAZO_MS,
  );

  it(
    'resetar duas vezes não duplica nada: os 80 da demonstração mais os reais',
    async () => {
      await criarClienteReal();
      await reiniciarDemonstracao(prisma, HOJE);
      const primeira = await totais();

      await reiniciarDemonstracao(prisma, HOJE);

      expect(await totais()).toEqual(primeira);
      expect(primeira.clientes).toBe(CLIENTES_DA_DEMONSTRACAO + 1);
    },
    PRAZO_MS,
  );

  it(
    'cliente da demonstração editado à mão volta ao cadastro original',
    async () => {
      const ancora = CLIENTES_ANCORA[0];
      if (!ancora) throw new Error('o seed não tem cliente âncora');
      await prisma.client.update({ where: { cnpj: ancora.cnpj }, data: { telefone: '(47) 90000-0000' } });

      await reiniciarDemonstracao(prisma, HOJE);

      const cliente = await prisma.client.findUniqueOrThrow({ where: { cnpj: ancora.cnpj } });
      expect(cliente.telefone).toBe(ancora.telefone);
      expect(await prisma.client.count()).toBe(CLIENTES_DA_DEMONSTRACAO);
    },
    PRAZO_MS,
  );
});
