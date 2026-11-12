// Primeiro import: troca o provedor para `hibrido` antes de `config/env` ser lido.
import './helpers/provedor-hibrido';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { HibridoErpProvider } from '../src/providers/erp/HibridoErpProvider';
import { EMAIL_GESTAO, reiniciarDemonstracao, SENHA_DEMONSTRACAO } from '../src/seed/demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * O seed de demonstração sob `ERP_PROVIDER=hibrido` (padrão e produção):
 * clientes do seed não têm nota importada, então a ficha mostra os dados
 * simulados (pelo `erpId`), com estoque, e o catálogo gravado em `ErpProduct`
 * alimenta `GET /erp/produtos`. Os totais do seed estão em `seed.test.ts`.
 */

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
});
