// Primeiro import: troca o provedor para `importado` antes de `config/env` ser lido.
import './helpers/provedor-importado';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ImportadoErpProvider } from '../src/providers/erp/ImportadoErpProvider';
import { CATALOGO } from '../src/providers/erp/mock/catalogo';
import { reiniciarDemonstracao, SENHA_DEMONSTRACAO, semear } from '../src/seed/demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * O seed de demonstração roda também com `ERP_PROVIDER=importado` (produção,
 * Etapa 12b), sem nenhum produto importado (`ErpProduct` vazio): os pedidos
 * saem do catálogo de demonstração direto, e o mesmo catálogo vai para
 * `ErpProduct`, para o check-in e as campanhas da demonstração o acharem. Os
 * totais e o resto do seed estão em `seed.test.ts` (provedor mock).
 */

const HOJE = new Date('2026-10-19T15:00:00.000Z');

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('seed de demonstração com o provedor importado', () => {
  it('reiniciarDemonstracao e semear rodam sem catálogo importado, com nome e preço do catálogo de demonstração', async () => {
    expect(erpProvider).toBeInstanceOf(ImportadoErpProvider);
    expect(await prisma.erpProduct.count()).toBe(0);

    await reiniciarDemonstracao(prisma, HOJE);
    await semear(prisma, HOJE);

    const itens = await prisma.visitItem.findMany();
    expect(itens.length).toBeGreaterThan(0);
    for (const item of itens) {
      const produto = CATALOGO.find((candidato) => candidato.sku === item.sku);
      expect(produto).toBeDefined();
      expect(item.produtoNome).toBe(produto?.nome);
      expect(item.precoUnitario.toNumber()).toBe(produto?.precoUnitario);
    }
  });

  it('grava o catálogo de demonstração em ErpProduct sem apagar os produtos importados; campanhas semeadas mostram nomes e aceitam edição', async () => {
    await prisma.erpProduct.create({ data: { codigo: '777', nome: 'Produto da nota', precoUnitario: 12.5 } });

    await reiniciarDemonstracao(prisma, HOJE);

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'gestor@chokolaten.com.br', senha: SENHA_DEMONSTRACAO });
    const token = login.body.token as string;

    const produtos = await request(app).get('/erp/produtos').set('Authorization', `Bearer ${token}`);
    expect(produtos.status).toBe(200);
    for (const { sku, nome, precoUnitario } of CATALOGO) {
      expect(produtos.body.data).toContainEqual({ sku, nome, precoUnitario });
    }
    expect(produtos.body.data).toContainEqual({ sku: '777', nome: 'Produto da nota', precoUnitario: 12.5 });

    const campanhas = await request(app).get('/campaigns').set('Authorization', `Bearer ${token}`);
    const blackFriday = (
      campanhas.body.data as { id: string; nome: string; produtos: { sku: string; nome: string }[] }[]
    ).find((campanha) => campanha.nome === 'Black Friday do Cacau');
    expect(blackFriday).toBeDefined();
    for (const produto of blackFriday!.produtos) {
      expect(produto.nome).toBe(CATALOGO.find((item) => item.sku === produto.sku)?.nome);
    }

    const salva = await prisma.campaign.findUniqueOrThrow({ where: { id: blackFriday!.id } });
    const edicao = await request(app)
      .put(`/campaigns/${salva.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: salva.nome,
        tipo: salva.tipo,
        inicio: salva.inicio.toISOString().slice(0, 10),
        fim: salva.fim.toISOString().slice(0, 10),
        descricao: salva.descricao,
        desconto: salva.desconto,
        produtos: salva.produtos,
      });
    expect(edicao.status).toBe(200);
  });
});
