// Primeiro import: troca o provedor para `importado` antes de `config/env` ser lido.
import './helpers/provedor-importado';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ImportadoErpProvider } from '../src/providers/erp/ImportadoErpProvider';
import * as seasonalEventRepository from '../src/repositories/seasonal-event.repository';
import { janelaDoAnoAnterior, periodoBase } from '../src/services/insights.regras';
import {
  colunaDateDaData,
  dataCalendario,
  fimDoDia,
  inicioDoDia,
  somarDias,
} from '../src/services/classificacao.service';
import * as erpService from '../src/services/erp.service';
import { truncateAllTables } from './helpers/db';

/**
 * Provedor de ERP `importado` (Etapa 12b): as vendas vêm das notas fiscais
 * importadas (`ErpSale`), lidas pelo CNPJ do destinatário. As notas são
 * gravadas direto via prisma (a leitura do PDF já tem os próprios testes em
 * `importacao-nf.test.ts`). Os pedidos dos check-ins (visitas VENDA com itens
 * e sem nota vinculada) entram no mesmo histórico, com `origem`.
 */

const SENHA_PADRAO = 'chokocrm123';
const CNPJ_EMPORIO = '11222333000181';
const CNPJ_CAFE = '11222333000262';
const CNPJ_SEM_NOTAS = '11222333000343';

let gestorId: string;
let representanteId: string;
let tokenGestor: string;
let tokenRep: string;
let importId: string;
let sequencia = 0;

type ItemDeTeste = { codigo: string; nome: string; quantidade: number; preco: number };

const ITENS_PADRAO: ItemDeTeste[] = [
  { codigo: '1001', nome: 'Bombom trufado ao leite', quantidade: 12, preco: 3.5 },
  { codigo: '2002', nome: 'Barra 70% cacau', quantidade: 6, preco: 9 },
];

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarCliente(cnpj: string, nomeFantasia: string, erpId: string | null = null): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato${cnpj}@cliente.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId,
    },
  });
  return cliente.id;
}

/** Nota importada emitida em `dia` ('AAAA-MM-DD') para o CNPJ, com os itens dados. */
async function criarNota(
  cnpj: string,
  dia: string,
  valorTotal: number,
  itens: ItemDeTeste[] = ITENS_PADRAO,
  numero?: string,
) {
  sequencia += 1;
  return prisma.erpSale.create({
    data: {
      // Como na chave real, o número da nota vai zerado à esquerda (aqui, no fim).
      chaveAcesso: `${String(sequencia).padStart(35, '0')}${(numero ?? String(1000 + sequencia)).padStart(9, '0')}`,
      numero: numero ?? String(1000 + sequencia),
      serie: '1',
      dataEmissao: colunaDateDaData(dia),
      naturezaOperacao: 'VENDA DE MERCADORIA',
      destinatarioCnpj: cnpj,
      destinatarioNome: `Destinatário ${cnpj}`,
      valorProdutos: valorTotal,
      desconto: 0,
      valorTotal,
      importId,
      vinculoStatus: 'SEM_VISITA',
      itens: {
        create: itens.map((item, ordem) => ({
          produtoCodigo: item.codigo,
          produtoNome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: item.preco,
          valorTotal: item.quantidade * item.preco,
          ordem,
        })),
      },
    },
  });
}

type ItemDoPedido = { sku: string; nome: string; quantidade: number; preco: number };

const ITENS_DO_PEDIDO: ItemDoPedido[] = [
  { sku: 'BAR0019', nome: 'Barra ao leite 100 g', quantidade: 3, preco: 27.9 },
  { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 2, preco: 10.05 },
];

/** Check-in gravado direto via prisma: VENDA com os itens dados (vazio = pedido sem itens). */
async function criarPedido(
  clientId: string,
  dataHora: Date,
  itens: ItemDoPedido[] = ITENS_DO_PEDIDO,
  { erpSaleId = null, resultado = 'VENDA' }: { erpSaleId?: string | null; resultado?: 'VENDA' | 'SEM_VENDA' } = {},
) {
  return prisma.visit.create({
    data: {
      clientId,
      userId: representanteId,
      dataHora,
      descricao: 'Pedido no check-in.',
      resultado,
      erpSaleId,
      itens: {
        create: itens.map((item) => ({
          sku: item.sku,
          produtoNome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: item.preco,
        })),
      },
    },
  });
}

/** Instante local de `dia` ('AAAA-MM-DD') às `hora`:00. */
function noDia(dia: string, hora: number): Date {
  return new Date(inicioDoDia(dia).getTime() + hora * 3_600_000);
}

/** Hoje ('AAAA-MM-DD') em America/Sao_Paulo, deslocado de `dias`. */
function diaRelativo(dias: number): string {
  return somarDias(dataCalendario(new Date()), dias);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const gestor = await prisma.user.create({
    data: { nome: 'Ricardo Menezes', email: 'ricardo.importado@chokolaten.com.br', role: 'GESTOR', senhaHash },
  });
  gestorId = gestor.id;
  const representante = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', email: 'eduarda.importado@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
  });
  representanteId = representante.id;

  const importacao = await prisma.erpImport.create({
    data: {
      userId: gestorId,
      nomeArquivo: 'notas.pdf',
      notasImportadas: 0,
      notasIgnoradas: 0,
      vinculadasAutomaticamente: 0,
      pendentes: 0,
      cnpjsSemCliente: [],
    },
  });
  importId = importacao.id;

  tokenGestor = await logar('ricardo.importado@chokolaten.com.br');
  tokenRep = await logar('eduarda.importado@chokolaten.com.br');
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('ImportadoErpProvider', () => {
  const provedor = new ImportadoErpProvider();

  it('não é simulado, não tem estoque, e o provedor em uso é ele', () => {
    expect(provedor.simulado).toBe(false);
    expect(provedor.estoqueDisponivel).toBe(false);
    expect(erpProvider).toBeInstanceOf(ImportadoErpProvider);
  });

  it('getLastSale devolve a nota mais recente do CNPJ, com o valor total e os produtos', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-09-10', 100);
    await criarNota(CNPJ_EMPORIO, '2026-10-20', 250.5);
    await criarNota(CNPJ_CAFE, '2026-10-30', 999);

    const venda = await provedor.getLastSale(CNPJ_EMPORIO);

    expect(venda).not.toBeNull();
    expect(dataCalendario(venda!.data)).toBe('2026-10-20');
    expect(venda!.valor).toBe(250.5);
    expect(venda!.produtos).toEqual([
      { sku: '1001', nome: 'Bombom trufado ao leite', quantidade: 12 },
      { sku: '2002', nome: 'Barra 70% cacau', quantidade: 6 },
    ]);
  });

  it('duas notas no mesmo dia: a de número maior é a mais recente, mesmo com 999 x 1000 (numero é texto)', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-10-20', 1, ITENS_PADRAO, '999');
    await criarNota(CNPJ_EMPORIO, '2026-10-20', 2, ITENS_PADRAO, '1000');

    expect((await provedor.getLastSale(CNPJ_EMPORIO))?.valor).toBe(2);
    expect((await provedor.getRecentSales(CNPJ_EMPORIO, 5)).map((venda) => venda.valor)).toEqual([2, 1]);
  });

  it('getSales filtra por dia de calendário com os dois limites inclusivos, da mais recente para a mais antiga', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-09-30', 1);
    await criarNota(CNPJ_EMPORIO, '2026-10-01', 2);
    await criarNota(CNPJ_EMPORIO, '2026-10-15', 3);
    await criarNota(CNPJ_EMPORIO, '2026-10-31', 4);
    await criarNota(CNPJ_EMPORIO, '2026-11-01', 5);
    await criarNota(CNPJ_CAFE, '2026-10-15', 6);

    const vendas = await provedor.getSales(CNPJ_EMPORIO, {
      inicio: inicioDoDia('2026-10-01'),
      fim: fimDoDia('2026-10-31'),
    });

    expect(vendas.map((venda) => [dataCalendario(venda.data), venda.valor])).toEqual([
      ['2026-10-31', 4],
      ['2026-10-15', 3],
      ['2026-10-01', 2],
    ]);
  });

  it('getPurchaseVolume soma o valor total e conta as notas do período', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-10-01', 100.1);
    await criarNota(CNPJ_EMPORIO, '2026-10-31', 200.2);
    await criarNota(CNPJ_EMPORIO, '2026-11-01', 400);
    await criarNota(CNPJ_CAFE, '2026-10-10', 800);

    const volume = await provedor.getPurchaseVolume(CNPJ_EMPORIO, {
      inicio: inicioDoDia('2026-10-01'),
      fim: fimDoDia('2026-10-31'),
    });

    expect(volume).toEqual({ total: 300.3, quantidadeVendas: 2 });
  });

  it('getStockHistory é sempre vazio: as notas não trazem estoque', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-10-01', 100);

    await expect(provedor.getStockHistory(CNPJ_EMPORIO)).resolves.toEqual([]);
  });

  it('CNPJ sem nota: sem última venda, sem vendas e volume zerado', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-10-01', 100);
    const periodo = { inicio: inicioDoDia('2026-01-01'), fim: fimDoDia('2026-12-31') };

    await expect(provedor.getLastSale(CNPJ_SEM_NOTAS)).resolves.toBeNull();
    await expect(provedor.getSales(CNPJ_SEM_NOTAS, periodo)).resolves.toEqual([]);
    await expect(provedor.getPurchaseVolume(CNPJ_SEM_NOTAS, periodo)).resolves.toEqual({
      total: 0,
      quantidadeVendas: 0,
    });
  });
});

describe('ImportadoErpProvider: notas + pedidos dos check-ins sem nota', () => {
  const provedor = new ImportadoErpProvider();

  it('getRecentSales mescla a nota e os 2 pedidos sem nota do cliente, com a origem, da mais recente para a mais antiga', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const cafeId = await criarCliente(CNPJ_CAFE, 'Cafe Blumenau');
    await criarNota(CNPJ_EMPORIO, '2026-10-01', 100, ITENS_PADRAO, '2455');
    const recente = await criarPedido(emporioId, noDia('2026-10-10', 14));
    const antigo = await criarPedido(emporioId, noDia('2026-09-20', 9), [
      { sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 1, preco: 45 },
    ]);
    await criarPedido(cafeId, noDia('2026-10-05', 10));

    const vendas = await provedor.getRecentSales(CNPJ_EMPORIO, 10);

    expect(vendas).toEqual([
      {
        data: noDia('2026-10-10', 14),
        // 3 × 27,90 + 2 × 10,05 = 103,80, em Decimal (sem 103,79999…).
        valor: 103.8,
        produtos: [
          { sku: 'BAR0019', nome: 'Barra ao leite 100 g', quantidade: 3 },
          { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 2 },
        ],
        origem: { tipo: 'pedido', visitaId: recente.id },
      },
      {
        data: inicioDoDia('2026-10-01'),
        valor: 100,
        produtos: [
          { sku: '1001', nome: 'Bombom trufado ao leite', quantidade: 12 },
          { sku: '2002', nome: 'Barra 70% cacau', quantidade: 6 },
        ],
        origem: { tipo: 'nota', numero: '2455' },
      },
      {
        data: noDia('2026-09-20', 9),
        valor: 45,
        produtos: [{ sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 1 }],
        origem: { tipo: 'pedido', visitaId: antigo.id },
      },
    ]);
    expect((await provedor.getRecentSales(CNPJ_EMPORIO, 2)).map((venda) => venda.origem?.tipo)).toEqual([
      'pedido',
      'nota',
    ]);
    expect((await provedor.getLastSale(CNPJ_EMPORIO))?.origem).toEqual({ tipo: 'pedido', visitaId: recente.id });
  });

  it('visita VENDA com nota vinculada (Review Focus 1) entra uma vez só, como a nota', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const nota = await criarNota(CNPJ_EMPORIO, '2026-10-01', 100, ITENS_PADRAO, '2455');
    await criarPedido(emporioId, noDia('2026-09-30', 10), ITENS_DO_PEDIDO, { erpSaleId: nota.id });
    const periodo = { inicio: inicioDoDia('2026-09-01'), fim: fimDoDia('2026-10-31') };

    const vendas = await provedor.getRecentSales(CNPJ_EMPORIO, 10);

    expect(vendas.map((venda) => [venda.valor, venda.origem])).toEqual([[100, { tipo: 'nota', numero: '2455' }]]);
    await expect(provedor.getSales(CNPJ_EMPORIO, periodo)).resolves.toHaveLength(1);
    await expect(provedor.getPurchaseVolume(CNPJ_EMPORIO, periodo)).resolves.toEqual({
      total: 100,
      quantidadeVendas: 1,
    });
  });

  it('visita VENDA sem itens (Review Focus 2) e visita SEM_VENDA são ignoradas: nenhuma venda de valor 0', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    await criarPedido(emporioId, noDia('2026-10-10', 10), []);
    await criarPedido(emporioId, noDia('2026-10-11', 10), ITENS_DO_PEDIDO, { resultado: 'SEM_VENDA' });
    const periodo = { inicio: inicioDoDia('2026-10-01'), fim: fimDoDia('2026-10-31') };

    await expect(provedor.getRecentSales(CNPJ_EMPORIO, 10)).resolves.toEqual([]);
    await expect(provedor.getLastSale(CNPJ_EMPORIO)).resolves.toBeNull();
    await expect(provedor.getSales(CNPJ_EMPORIO, periodo)).resolves.toEqual([]);
    await expect(provedor.getPurchaseVolume(CNPJ_EMPORIO, periodo)).resolves.toEqual({
      total: 0,
      quantidadeVendas: 0,
    });
  });

  it('getSales e getPurchaseVolume somam nota + pedidos do período (instantes inclusivos para o pedido)', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    await criarNota(CNPJ_EMPORIO, '2026-10-31', 200.2, ITENS_PADRAO, '3000');
    await criarNota(CNPJ_EMPORIO, '2026-11-01', 999, ITENS_PADRAO, '3001');
    const noInicio = await criarPedido(emporioId, inicioDoDia('2026-10-01'));
    const noFim = await criarPedido(emporioId, fimDoDia('2026-10-31'), [
      { sku: 'CX-PRESENTE', nome: 'Caixa presente', quantidade: 1, preco: 45 },
    ]);
    await criarPedido(emporioId, new Date(inicioDoDia('2026-10-01').getTime() - 1));
    await criarPedido(emporioId, inicioDoDia('2026-11-01'));
    const periodo = { inicio: inicioDoDia('2026-10-01'), fim: fimDoDia('2026-10-31') };

    const vendas = await provedor.getSales(CNPJ_EMPORIO, periodo);

    expect(vendas.map((venda) => [venda.valor, venda.origem])).toEqual([
      [45, { tipo: 'pedido', visitaId: noFim.id }],
      [200.2, { tipo: 'nota', numero: '3000' }],
      [103.8, { tipo: 'pedido', visitaId: noInicio.id }],
    ]);
    await expect(provedor.getPurchaseVolume(CNPJ_EMPORIO, periodo)).resolves.toEqual({
      total: 349,
      quantidadeVendas: 3,
    });
  });

  it('pedido e nota no mesmo instante: a nota vem antes', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    await criarNota(CNPJ_EMPORIO, '2026-10-01', 100, ITENS_PADRAO, '2455');
    await criarPedido(emporioId, inicioDoDia('2026-10-01'));

    const vendas = await provedor.getRecentSales(CNPJ_EMPORIO, 10);

    expect(vendas.map((venda) => venda.origem?.tipo)).toEqual(['nota', 'pedido']);
  });

  it('nota PENDENTE que sugere a visita: o pedido dela não entra (a nota já é essa venda); vinculada, continua uma vez só', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const visita = await criarPedido(emporioId, noDia('2026-09-28', 10));
    const nota = await criarNota(CNPJ_EMPORIO, '2026-10-01', 100, ITENS_PADRAO, '2455');
    await prisma.erpSale.update({
      where: { id: nota.id },
      data: { vinculoStatus: 'PENDENTE', visitaSugeridaId: visita.id },
    });
    const periodo = { inicio: inicioDoDia('2026-09-01'), fim: fimDoDia('2026-10-31') };

    const vendas = await provedor.getRecentSales(CNPJ_EMPORIO, 10);
    expect(vendas.map((venda) => venda.origem)).toEqual([{ tipo: 'nota', numero: '2455' }]);
    await expect(provedor.getPurchaseVolume(CNPJ_EMPORIO, periodo)).resolves.toEqual({
      total: 100,
      quantidadeVendas: 1,
    });

    // O gestor vincula a pendência: a visita passa a apontar para a nota.
    await prisma.$transaction([
      prisma.erpSale.update({ where: { id: nota.id }, data: { vinculoStatus: 'VINCULADA', visitaSugeridaId: null } }),
      prisma.visit.update({ where: { id: visita.id }, data: { erpSaleId: nota.id } }),
    ]);
    await expect(provedor.getPurchaseVolume(CNPJ_EMPORIO, periodo)).resolves.toEqual({
      total: 100,
      quantidadeVendas: 1,
    });
  });

  it('nota RECUSADA que apontava para a visita também a tira do histórico; visita sem nota apontando entra', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const apontada = await criarPedido(emporioId, noDia('2026-09-28', 10));
    const livre = await criarPedido(emporioId, noDia('2026-10-05', 10));
    const nota = await criarNota(CNPJ_EMPORIO, '2026-10-01', 100, ITENS_PADRAO, '2455');
    await prisma.erpSale.update({
      where: { id: nota.id },
      data: { vinculoStatus: 'RECUSADA', visitaSugeridaId: apontada.id },
    });

    const vendas = await provedor.getRecentSales(CNPJ_EMPORIO, 10);

    expect(vendas.map((venda) => venda.origem)).toEqual([
      { tipo: 'pedido', visitaId: livre.id },
      { tipo: 'nota', numero: '2455' },
    ]);
  });
});

describe('erp.service com o provedor importado', () => {
  it('a chave do cliente é o CNPJ, com ou sem erpId', () => {
    expect(erpService.chaveDoCliente({ erpId: 'ERP-1001', cnpj: CNPJ_EMPORIO })).toBe(CNPJ_EMPORIO);
    expect(erpService.chaveDoCliente({ erpId: null, cnpj: CNPJ_CAFE })).toBe(CNPJ_CAFE);
    expect(erpService.estoqueDisponivel()).toBe(false);
    expect(erpService.erpSimulado()).toBe(false);
  });
});

describe('GET /clients/:id/erp (importado)', () => {
  it('OK com as 5 últimas vendas, volume dos 90 dias e estoque indisponível, mesmo sem erpId', async () => {
    const clienteId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    await criarNota(CNPJ_EMPORIO, diaRelativo(-120), 50);
    await criarNota(CNPJ_EMPORIO, diaRelativo(-60), 60);
    await criarNota(CNPJ_EMPORIO, diaRelativo(-40), 70);
    await criarNota(CNPJ_EMPORIO, diaRelativo(-30), 80);
    await criarNota(CNPJ_EMPORIO, diaRelativo(-10), 90);
    const maisRecente = await criarNota(CNPJ_EMPORIO, diaRelativo(0), 100, [
      { codigo: '3003', nome: 'Pão de mel', quantidade: 24, preco: 4 },
    ]);
    await criarNota(CNPJ_CAFE, diaRelativo(-1), 5000);

    const espiaoVendas = jest.spyOn(erpProvider, 'getSales');

    const res = await request(app).get(`/clients/${clienteId}/erp`).set('Authorization', `Bearer ${tokenRep}`);

    // Uma consulta das 5 mais recentes, sem ler o histórico inteiro.
    expect(espiaoVendas).not.toHaveBeenCalled();
    espiaoVendas.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.simulado).toBe(false);
    expect(res.body.estoqueIndisponivel).toBe(true);
    expect(res.body.estoque).toBeNull();
    expect(res.body.ultimaVenda.valor).toBe(100);
    expect(dataCalendario(new Date(res.body.ultimaVenda.data))).toBe(diaRelativo(0));
    expect(res.body.volume90Dias).toEqual({ total: 400, quantidadeVendas: 5 });
    expect(res.body.ultimasVendas).toHaveLength(5);
    expect(res.body.ultimasVendas.map((venda: { data: string }) => venda.data)).toEqual([
      diaRelativo(0),
      diaRelativo(-10),
      diaRelativo(-30),
      diaRelativo(-40),
      diaRelativo(-60),
    ]);
    expect(res.body.ultimasVendas[0]).toEqual({
      data: diaRelativo(0),
      valor: 100,
      produtos: [{ sku: '3003', nome: 'Pão de mel', quantidade: 24 }],
      origem: { tipo: 'nota', numero: maisRecente.numero },
    });
  });

  it('últimas vendas com a origem (nota e pedido do check-in) e última venda = pedido mais recente', async () => {
    const clienteId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const nota = await criarNota(CNPJ_EMPORIO, diaRelativo(-5), 100);
    const pedido = await criarPedido(clienteId, noDia(diaRelativo(-2), 10));

    const res = await request(app).get(`/clients/${clienteId}/erp`).set('Authorization', `Bearer ${tokenRep}`);

    expect(res.status).toBe(200);
    expect(res.body.ultimaVenda).toEqual({ data: noDia(diaRelativo(-2), 10).toISOString(), valor: 103.8 });
    expect(res.body.volume90Dias).toEqual({ total: 203.8, quantidadeVendas: 2 });
    expect(
      res.body.ultimasVendas.map((venda: { data: string; valor: number; origem: unknown }) => [
        venda.data,
        venda.valor,
        venda.origem,
      ]),
    ).toEqual([
      [diaRelativo(-2), 103.8, { tipo: 'pedido', visitaId: pedido.id }],
      [diaRelativo(-5), 100, { tipo: 'nota', numero: nota.numero }],
    ]);
  });

  it('cliente sem nota (Review Focus 5): OK, sem última venda, volume zerado e sem últimas vendas', async () => {
    const clienteId = await criarCliente(CNPJ_SEM_NOTAS, 'Doceria Jaragua', 'ERP-1001');
    await criarNota(CNPJ_EMPORIO, diaRelativo(-5), 100);

    const res = await request(app).get(`/clients/${clienteId}/erp`).set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'OK',
      simulado: false,
      ultimaVenda: null,
      volume90Dias: { total: 0, quantidadeVendas: 0 },
      estoque: null,
      estoqueIndisponivel: true,
      ultimasVendas: [],
    });
  });

  it('nota importada antes de o cliente existir aparece assim que ele é cadastrado (leitura pelo CNPJ)', async () => {
    await criarNota(CNPJ_CAFE, diaRelativo(-3), 321);
    const clienteId = await criarCliente(CNPJ_CAFE, 'Cafe Blumenau');

    const res = await request(app).get(`/clients/${clienteId}/erp`).set('Authorization', `Bearer ${tokenRep}`);

    expect(res.body.status).toBe('OK');
    expect(res.body.ultimaVenda.valor).toBe(321);
  });
});

describe('GET /erp/produtos (importado)', () => {
  it('lista o catálogo aprendido das notas (ErpProduct), por nome', async () => {
    await prisma.erpProduct.createMany({
      data: [
        { codigo: '2002', nome: 'Barra 70% cacau', precoUnitario: 9 },
        { codigo: '1001', nome: 'Bombom trufado ao leite', precoUnitario: 3.5 },
      ],
    });

    const res = await request(app).get('/erp/produtos').set('Authorization', `Bearer ${tokenRep}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { sku: '2002', nome: 'Barra 70% cacau', precoUnitario: 9 },
      { sku: '1001', nome: 'Bombom trufado ao leite', precoUnitario: 3.5 },
    ]);
    await expect(erpService.buscarProduto('1001')).resolves.toEqual({
      sku: '1001',
      nome: 'Bombom trufado ao leite',
      precoUnitario: 3.5,
    });
    await expect(erpService.buscarProduto('PAO-MEL')).resolves.toBeNull();
  });
});

describe('POST /clients/:id/visits (importado)', () => {
  it('check-in com pedido usa o catálogo importado (ErpProduct); SKU fora dele é recusado', async () => {
    const clienteId = await criarCliente(CNPJ_EMPORIO, 'Empório Pomerode');
    await prisma.erpProduct.create({ data: { codigo: 'BAR0019', nome: 'Barra ao leite 100 g', precoUnitario: 8.9 } });
    const postar = (sku: string) =>
      request(app)
        .post(`/clients/${clienteId}/visits`)
        .set('Authorization', `Bearer ${tokenRep}`)
        .send({ descricao: 'Pedido de barras.', resultado: 'VENDA', itens: [{ sku, quantidade: 4 }] });

    const res = await postar('BAR0019');

    expect(res.status).toBe(201);
    expect(res.body.itens).toEqual([
      { sku: 'BAR0019', produtoNome: 'Barra ao leite 100 g', quantidade: 4, precoUnitario: 8.9 },
    ]);
    const gravados = await prisma.visitItem.findMany({ where: { visitId: res.body.id } });
    expect(gravados.map((item) => [item.sku, item.produtoNome, item.quantidade, item.precoUnitario.toFixed(2)])).toEqual([
      ['BAR0019', 'Barra ao leite 100 g', 4, '8.90'],
    ]);

    const recusada = await postar('BOMB-SORT');

    expect(recusada.status).toBe(400);
    expect(recusada.body.error.code).toBe('VALIDATION_ERROR');
    expect(recusada.body.error.message).toBe('Produto não encontrado no catálogo.');
    expect(await prisma.visit.count({ where: { clientId: clienteId } })).toBe(1);
  });
});

describe('GET /dashboard/vendas-mensais (importado)', () => {
  it('soma as notas do mês de cada cliente ativo, pelo CNPJ', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    await criarCliente(CNPJ_CAFE, 'Cafe Blumenau');
    const hoje = diaRelativo(0);
    const primeiroDoMes = `${hoje.slice(0, 7)}-01`;
    await criarNota(CNPJ_EMPORIO, primeiroDoMes, 150);
    await criarNota(CNPJ_EMPORIO, hoje, 50.25);
    await criarNota(CNPJ_SEM_NOTAS, hoje, 999);

    const res = await request(app).get('/dashboard/vendas-mensais').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.simulado).toBe(false);
    expect(res.body.clientesConsultados).toBe(2);
    expect(res.body.clientesIndisponiveis).toBe(0);
    const mes = res.body.meses.find((ponto: { mes: string }) => ponto.mes === hoje.slice(0, 7));
    expect(mes.total).toBe(200.25);
    expect(mes.clientes).toEqual([{ id: emporioId, nomeFantasia: 'Emporio Pomerode', total: 200.25 }]);
  });

  it('soma também os pedidos dos check-ins sem nota do mês', async () => {
    const emporioId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const hoje = diaRelativo(0);
    const primeiroDoMes = `${hoje.slice(0, 7)}-01`;
    await criarNota(CNPJ_EMPORIO, primeiroDoMes, 150);
    await criarPedido(emporioId, inicioDoDia(primeiroDoMes));

    const res = await request(app).get('/dashboard/vendas-mensais').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    const mes = res.body.meses.find((ponto: { mes: string }) => ponto.mes === hoje.slice(0, 7));
    expect(mes.total).toBe(253.8);
    expect(mes.clientes).toEqual([{ id: emporioId, nomeFantasia: 'Emporio Pomerode', total: 253.8 }]);
  });
});

describe('GET /clients/:id/insights (importado)', () => {
  it('pedido do check-in no Natal do ano passado gera a sugestão do mesmo período do ano passado', async () => {
    const clienteId = await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const dataFim = new Date();
    dataFim.setUTCDate(dataFim.getUTCDate() + 40);
    dataFim.setUTCHours(12, 0, 0, 0);
    const dataInicio = new Date(dataFim);
    dataInicio.setUTCDate(dataInicio.getUTCDate() - 30);
    await seasonalEventRepository.upsertMany([
      { nome: 'Natal teste', chave: 'NATAL', dataInicio, dataFim, produtosSugeridos: ['caixas presente'] },
    ]);
    const janela = janelaDoAnoAnterior('NATAL', dataFim.getUTCFullYear());
    const base = periodoBase(janela);
    // Base: uma nota no ano anterior à janela; na janela, só o pedido do check-in.
    await criarNota(CNPJ_EMPORIO, somarDias(base.inicio, 30), 365);
    await criarPedido(clienteId, noDia(somarDias(janela.fim, -3), 15));

    const res = await request(app).get(`/clients/${clienteId}/insights`).set('Authorization', `Bearer ${tokenRep}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.eventosSemHistorico).toEqual([]);
    expect(res.body.sugestoes).toHaveLength(1);
    expect(res.body.sugestoes[0].comprasNaJanela).toBe(103.8);
    expect(res.body.sugestoes[0].periodoComparado).toEqual({ inicio: janela.inicio, fim: janela.fim });
    expect(res.body.sugestoes[0].texto).toContain('no mesmo período do ano passado');
  });
});

describe('GET /insights/manager-alerts (importado)', () => {
  it('sem estoque no ERP: estoqueIndisponivel, sem alertas e sem clientes indisponíveis', async () => {
    await criarCliente(CNPJ_EMPORIO, 'Emporio Pomerode');
    const dataFim = new Date();
    dataFim.setUTCDate(dataFim.getUTCDate() + 40);
    dataFim.setUTCHours(12, 0, 0, 0);
    const dataInicio = new Date(dataFim);
    dataInicio.setUTCDate(dataInicio.getUTCDate() - 30);
    await seasonalEventRepository.upsertMany([
      { nome: 'Natal teste', chave: 'NATAL', dataInicio, dataFim, produtosSugeridos: ['caixas presente'] },
    ]);

    const res = await request(app).get('/insights/manager-alerts').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.simulado).toBe(false);
    expect(res.body.estoqueIndisponivel).toBe(true);
    expect(res.body.eventos).toHaveLength(1);
    expect(res.body.alertas).toEqual([]);
    expect(res.body.clientesConsultados).toBe(0);
    expect(res.body.clientesIndisponiveis).toBe(0);
  });
});

describe('GET /erp/situacao (importado)', () => {
  it('sem notas nem importações: datas nulas', async () => {
    await prisma.erpImport.deleteMany();

    const res = await request(app).get('/erp/situacao').set('Authorization', `Bearer ${tokenRep}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      provedor: 'importado',
      simulado: false,
      estoqueDisponivel: false,
      ultimaVendaEm: null,
      ultimaImportacaoEm: null,
    });
  });

  it('com notas: a data de emissão mais recente e o instante da última importação', async () => {
    await criarNota(CNPJ_EMPORIO, '2026-10-20', 100);
    await criarNota(CNPJ_CAFE, '2026-11-03', 100);
    await criarNota(CNPJ_CAFE, '2026-09-01', 100);
    const maisRecente = await prisma.erpImport.create({
      data: {
        userId: gestorId,
        nomeArquivo: 'notas-2.pdf',
        criadoEm: new Date('2030-01-02T10:00:00.000Z'),
        notasImportadas: 0,
        notasIgnoradas: 0,
        vinculadasAutomaticamente: 0,
        pendentes: 0,
        cnpjsSemCliente: [],
      },
    });

    const res = await request(app).get('/erp/situacao').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      provedor: 'importado',
      simulado: false,
      estoqueDisponivel: false,
      ultimaVendaEm: '2026-11-03',
      ultimaImportacaoEm: maisRecente.criadoEm.toISOString(),
    });
  });
});
