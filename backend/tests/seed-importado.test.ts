// Primeiro import: troca o provedor para `importado` antes de `config/env` ser lido.
import './helpers/provedor-importado';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ImportadoErpProvider } from '../src/providers/erp/ImportadoErpProvider';
import { CATALOGO } from '../src/providers/erp/mock/catalogo';
import { EMAIL_GESTAO, reiniciarDemonstracao, SENHA_DEMONSTRACAO, semear } from '../src/seed/demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * O seed de demonstração roda também com `ERP_PROVIDER=importado` (produção,
 * Etapa 12b), sem nenhum produto importado (`ErpProduct` vazio): os pedidos
 * saem do catálogo de demonstração direto, e o mesmo catálogo vai para
 * `ErpProduct`, para o check-in e as campanhas da demonstração o acharem. Os
 * totais e o resto do seed estão em `seed.test.ts` (provedor mock). O reset
 * também solta as notas vinculadas ou pendentes (visitas apagadas), para uma
 * reimportação decidir o vínculo de novo.
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
      .send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
    const token = login.body.token as string;

    const produtos = await request(app).get('/erp/produtos').set('Authorization', `Bearer ${token}`);
    expect(produtos.status).toBe(200);
    for (const { sku, nome, precoUnitario } of CATALOGO) {
      expect(produtos.body.data).toContainEqual({ sku, nome, precoUnitario });
    }
    expect(produtos.body.data).toContainEqual({ sku: '777', nome: 'Produto da nota', precoUnitario: 12.5 });

    const campanhas = await request(app).get('/campaigns').set('Authorization', `Bearer ${token}`);
    // A campanha sazonal do mês (Oktoberfest em outubro de 2026)
    const campanhaDoMes = (
      campanhas.body.data as { id: string; nome: string; produtos: { sku: string; nome: string }[] }[]
    ).find((campanha) => campanha.nome === 'Oktoberfest Chokolaten 2026');
    expect(campanhaDoMes).toBeDefined();
    for (const produto of campanhaDoMes!.produtos) {
      expect(produto.nome).toBe(CATALOGO.find((item) => item.sku === produto.sku)?.nome);
    }

    const salva = await prisma.campaign.findUniqueOrThrow({ where: { id: campanhaDoMes!.id } });
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

  it('notas de um CNPJ que saiu do seed ficam SEM_CLIENTE, sem visita sugerida (inclusive as recusadas)', async () => {
    const gestor = await prisma.user.create({
      data: { nome: 'Gestor do teste', email: 'gestor.reset@chokolaten.com.br', role: 'GESTOR', senhaHash: 'x' },
    });
    const cliente = await prisma.client.create({
      data: {
        razaoSocial: 'Don Giacomo Ltda',
        nomeFantasia: 'Don Giacomo',
        cnpj: '25382906000149',
        cidade: 'Pomerode',
        endereco: 'Rua Boa Vista, 80',
        telefone: '(47) 3387-5820',
        email: 'contato@exemplo.com.br',
        representanteId: gestor.id,
      },
    });
    const visita = await prisma.visit.create({
      data: { clientId: cliente.id, userId: gestor.id, dataHora: HOJE, descricao: 'Visita', resultado: 'VENDA' },
    });
    const importacao = await prisma.erpImport.create({
      data: {
        userId: gestor.id,
        nomeArquivo: 'notas.pdf',
        notasImportadas: 4,
        notasIgnoradas: 0,
        vinculadasAutomaticamente: 1,
        pendentes: 1,
        cnpjsSemCliente: [],
      },
    });
    const nota = (numero: string, vinculoStatus: 'AUTOMATICO' | 'VINCULADA' | 'PENDENTE' | 'RECUSADA') =>
      prisma.erpSale.create({
        data: {
          chaveAcesso: `422611418870170001905500100000${numero}1844654424`,
          numero,
          serie: '1',
          dataEmissao: new Date('2026-10-19'),
          naturezaOperacao: 'VENDA',
          destinatarioCnpj: '25382906000149',
          destinatarioNome: 'Don Giacomo Ltda',
          clientId: cliente.id,
          valorProdutos: 100,
          desconto: 0,
          valorTotal: 100,
          importId: importacao.id,
          vinculoStatus,
          visitaSugeridaId: vinculoStatus === 'PENDENTE' ? visita.id : null,
        },
      });
    const vinculada = await nota('2455', 'VINCULADA');
    const automatica = await nota('2456', 'AUTOMATICO');
    const pendente = await nota('2457', 'PENDENTE');
    const recusada = await nota('2458', 'RECUSADA');
    await prisma.visit.update({ where: { id: visita.id }, data: { erpSaleId: vinculada.id } });

    await reiniciarDemonstracao(prisma, HOJE);

    const depois = await prisma.erpSale.findMany({ include: { visita: true } });
    const porId = new Map(depois.map((n) => [n.id, n]));
    // O CNPJ não está no seed: depois do reset ninguém é dono das notas, e todas vão
    // para "CNPJs sem cliente no CRM" (a recusada inclusive: a visita recusada não existe mais).
    for (const id of [vinculada.id, automatica.id, pendente.id, recusada.id]) {
      expect(porId.get(id)).toMatchObject({
        vinculoStatus: 'SEM_CLIENTE',
        clientId: null,
        visitaSugeridaId: null,
        visita: null,
      });
    }
  });
});
