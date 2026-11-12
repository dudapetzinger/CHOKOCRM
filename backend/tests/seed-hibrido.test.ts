// Primeiro import: troca o provedor para `hibrido` antes de `config/env` ser lido.
import './helpers/provedor-hibrido';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { HibridoErpProvider } from '../src/providers/erp/HibridoErpProvider';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import { CLIENTES_ANCORA, EMAIL_GESTAO, reiniciarDemonstracao, SENHA_DEMONSTRACAO } from '../src/seed/demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * O seed de demonstração sob `ERP_PROVIDER=hibrido` (padrão e produção):
 * clientes do seed não têm nota importada, então a ficha mostra os dados
 * simulados (pelo `erpId`), com estoque, e o catálogo gravado em `ErpProduct`
 * alimenta `GET /erp/produtos`. Os totais do seed estão em `seed.test.ts`.
 */

// O extrator do PDF (pdf.js num worker) é trocado pelas linhas do fixture, como em importacao-leitura.test.ts.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);

// CNPJ da DANFE do fixture: a parceira real, que nenhum cliente do seed usa.
const CNPJ_NF = '25382906000149';
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);

const HOJE = new Date('2026-10-19T15:00:00.000Z');

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('seed de demonstração com o provedor híbrido', () => {
  it('o provedor em uso é o híbrido e a recriação da demonstração roda', async () => {
    expect(erpProvider).toBeInstanceOf(HibridoErpProvider);
    await reiniciarDemonstracao(prisma, HOJE);
    expect(await prisma.client.count()).toBeGreaterThan(0);
  });

  it('cliente do seed sem nota responde OK com estoque (fonte simulada)', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
    const token = login.body.token as string;
    const cliente = await prisma.client.findFirstOrThrow({ where: { erpId: { not: null } } });

    const resposta = await request(app).get(`/clients/${cliente.id}/erp`).set('Authorization', `Bearer ${token}`);

    expect(resposta.status).toBe(200);
    expect(resposta.body.status).toBe('OK');
    expect(resposta.body.estoque).not.toBeNull();
    expect(resposta.body.estoqueIndisponivel).toBe(false);
  });

  it('GET /erp/produtos lista o catálogo gravado em ErpProduct', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
    const token = login.body.token as string;

    const gravados = await prisma.erpProduct.count();
    const resposta = await request(app).get('/erp/produtos').set('Authorization', `Bearer ${token}`);

    expect(gravados).toBeGreaterThan(0);
    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toHaveLength(gravados);
  });

  describe('notas importadas depois de recriar a demonstração', () => {
    async function tokenDaGestao(): Promise<string> {
      const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
      return login.body.token as string;
    }

    it('a nota de um CNPJ que não está no seed vai para "CNPJs sem cliente no CRM"', async () => {
      await reiniciarDemonstracao(prisma, HOJE);
      const token = await tokenDaGestao();
      extrairMock.mockResolvedValue([{ numero: 1, linhas: LINHAS_NF_2455 }]);
      const importada = await request(app)
        .post('/erp/importacoes?nome=notas.pdf')
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('%PDF-1.4 simulado'));
      expect(importada.status).toBe(201);
      expect(await prisma.client.findUnique({ where: { cnpj: CNPJ_NF } })).toBeNull();

      await reiniciarDemonstracao(prisma, HOJE);

      const nota = await prisma.erpSale.findFirstOrThrow({ where: { destinatarioCnpj: CNPJ_NF } });
      expect(nota.clientId).toBeNull();
      expect(nota.vinculoStatus).toBe('SEM_CLIENTE');
      expect(nota.visitaSugeridaId).toBeNull();
      const resposta = await request(app).get('/erp/sem-cliente').set('Authorization', `Bearer ${await tokenDaGestao()}`);
      expect(resposta.status).toBe(200);
      expect(resposta.body.data.map((grupo: { cnpj: string }) => grupo.cnpj)).toContain(CNPJ_NF);
    });

    it('a nota de um CNPJ que continua no seed segue alimentando o cliente', async () => {
      await reiniciarDemonstracao(prisma, HOJE);
      const ancora = CLIENTES_ANCORA[0];
      if (!ancora) throw new Error('o seed não tem cliente âncora');
      const cliente = await prisma.client.findUniqueOrThrow({ where: { cnpj: ancora.cnpj } });
      const importacao = await prisma.erpImport.create({
        data: {
          userId: (await prisma.user.findFirstOrThrow({ where: { email: EMAIL_GESTAO } })).id,
          nomeArquivo: 'notas.pdf',
          notasImportadas: 1,
          notasIgnoradas: 0,
          vinculadasAutomaticamente: 0,
          pendentes: 0,
          cnpjsSemCliente: [],
        },
      });
      await prisma.erpSale.create({
        data: {
          chaveAcesso: '42261100000000000000550010000000011000000011',
          numero: '1',
          serie: '1',
          dataEmissao: new Date('2026-10-10'),
          naturezaOperacao: 'VENDA',
          destinatarioCnpj: ancora.cnpj,
          destinatarioNome: ancora.razaoSocial,
          clientId: cliente.id,
          valorProdutos: 100,
          desconto: 0,
          valorTotal: 100,
          importId: importacao.id,
          vinculoStatus: 'VINCULADA',
        },
      });

      await reiniciarDemonstracao(prisma, HOJE);

      const novo = await prisma.client.findUniqueOrThrow({ where: { cnpj: ancora.cnpj } });
      const nota = await prisma.erpSale.findFirstOrThrow({ where: { destinatarioCnpj: ancora.cnpj } });
      expect(nota.clientId).toBe(novo.id);
      expect(nota.vinculoStatus).toBe('SEM_VISITA');
      const token = await tokenDaGestao();
      const sem = await request(app).get('/erp/sem-cliente').set('Authorization', `Bearer ${token}`);
      expect(sem.body.data.map((grupo: { cnpj: string }) => grupo.cnpj)).not.toContain(ancora.cnpj);
      const ficha = await request(app).get(`/clients/${novo.id}/erp`).set('Authorization', `Bearer ${token}`);
      expect(ficha.status).toBe(200);
      expect(ficha.body.estoqueIndisponivel).toBe(true);
      expect(ficha.body.ultimasVendas[0].origem).toEqual({ tipo: 'nota', numero: '1' });
    });
  });
});
