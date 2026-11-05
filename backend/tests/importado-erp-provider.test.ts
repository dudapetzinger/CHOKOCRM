// Primeiro import: troca o provedor para `importado` antes de `config/env` ser lido.
import './helpers/provedor-importado';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ImportadoErpProvider } from '../src/providers/erp/ImportadoErpProvider';
import * as seasonalEventRepository from '../src/repositories/seasonal-event.repository';
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
 * `importacao-nf.test.ts`).
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
    await criarNota(CNPJ_EMPORIO, diaRelativo(0), 100, [{ codigo: '3003', nome: 'Pão de mel', quantidade: 24, preco: 4 }]);
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
    });
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
