// Primeiro import: troca o provedor para `hibrido` antes de `config/env` ser lido.
import './helpers/provedor-hibrido';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { chaveHibrida, decomporChaveHibrida } from '../src/providers/erp/chave-hibrida';
import { HibridoErpProvider } from '../src/providers/erp/HibridoErpProvider';
import { colunaDateDaData } from '../src/services/classificacao.service';
import * as erpService from '../src/services/erp.service';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import { ativarDataDeDemonstracao } from './helpers/data-de-demonstracao';
import { truncateAllTables } from './helpers/db';

/**
 * Provedor de ERP `hibrido`: uma fonte por cliente, nunca soma. Cliente com
 * nota importada do CNPJ → as notas (sem estoque); sem nota e com `erpId` →
 * o ERP simulado; sem nenhum dos dois → `SEM_ERP_ID`. A nota do cliente B é
 * gravada direto via prisma (como em `importado-erp-provider.test.ts`); a do
 * cliente A passa pela importação de verdade (`POST /erp/importacoes`, com o
 * extrator de PDF trocado pelas linhas do fixture da NF 2455, como em
 * `importacao-nf.test.ts`), para provar a troca de fonte na hora.
 */

jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);

const SENHA_PADRAO = 'chokocrm123';
/** CNPJ do destinatário da NF 2455 (fixture `danfe-2455.txt`). */
const CNPJ_NF_2455 = '25382906000149';
const VALOR_NF_2455 = 1529.98;
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);
/** `erpId` calibrado da demonstração (Empório Pomerode): compra recente e estoque no mock. */
const ERP_ID_COM_VENDAS = '10272';
/** `erpId` calibrado (Empório do Vale Brusque): item BAIXO de Natal no estoque do mock de 05 a 26/11/2026. */
const ERP_ID_COM_ESTOQUE_BAIXO_DE_NATAL = '10865';
const CNPJ_B = '11222333000181';
const CNPJ_C = '11222333000262';
const DIA_NOTA_B = '2026-10-20';
const VALOR_NOTA_B = 480.5;

let representanteId: string;
let tokenGestor: string;
let importId: string;
let clienteA: string;
let clienteB: string;
let clienteC: string;

async function logar(usuario: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarCliente(cnpj: string, nomeFantasia: string, erpId: string | null): Promise<string> {
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

/** Nota importada do cliente B, gravada direto (como `criarNota` de `importado-erp-provider.test.ts`). */
async function criarNotaDeB(): Promise<void> {
  await prisma.erpSale.create({
    data: {
      chaveAcesso: `${'1'.padStart(35, '0')}${'3001'.padStart(9, '0')}`,
      numero: '3001',
      serie: '1',
      dataEmissao: colunaDateDaData(DIA_NOTA_B),
      naturezaOperacao: 'VENDA DE MERCADORIA',
      destinatarioCnpj: CNPJ_B,
      destinatarioNome: 'Doceria B Ltda',
      valorProdutos: VALOR_NOTA_B,
      desconto: 0,
      valorTotal: VALOR_NOTA_B,
      importId,
      clientId: clienteB,
      vinculoStatus: 'SEM_VISITA',
      itens: {
        create: [
          {
            produtoCodigo: '1001',
            produtoNome: 'Bombom trufado ao leite',
            quantidade: 10,
            precoUnitario: 48.05,
            valorTotal: VALOR_NOTA_B,
            ordem: 0,
          },
        ],
      },
    },
  });
}

function autenticado(caminho: string) {
  return request(app).get(caminho).set('Authorization', `Bearer ${tokenGestor}`);
}

beforeEach(async () => {
  await truncateAllTables();
  extrairMock.mockReset();
  extrairMock.mockResolvedValue([{ numero: 1, linhas: LINHAS_NF_2455 }]);

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const gestor = await prisma.user.create({
    data: { nome: 'Ricardo Menezes', usuario: 'ricardo.hibrido', role: 'GESTOR', senhaHash },
  });
  const representante = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', usuario: 'eduarda.hibrido', role: 'REPRESENTANTE', senhaHash },
  });
  representanteId = representante.id;

  const importacao = await prisma.erpImport.create({
    data: {
      userId: gestor.id,
      nomeArquivo: 'notas.pdf',
      notasImportadas: 0,
      notasIgnoradas: 0,
      vinculadasAutomaticamente: 0,
      pendentes: 0,
      cnpjsSemCliente: [],
    },
  });
  importId = importacao.id;

  clienteA = await criarCliente(CNPJ_NF_2455, 'Don Giacomo', ERP_ID_COM_VENDAS);
  clienteB = await criarCliente(CNPJ_B, 'Doceria B', null);
  clienteC = await criarCliente(CNPJ_C, 'Padaria C', null);
  await criarNotaDeB();

  tokenGestor = await logar('ricardo.hibrido');
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('chaveHibrida', () => {
  it('compõe e decompõe CNPJ e erpId (erpId ausente volta como null)', () => {
    expect(decomporChaveHibrida(chaveHibrida('12345678000195', null))).toEqual({
      cnpj: '12345678000195',
      erpId: null,
    });
    expect(decomporChaveHibrida(chaveHibrida('12345678000195', '12345'))).toEqual({
      cnpj: '12345678000195',
      erpId: '12345',
    });
  });
});

describe('HibridoErpProvider em uso', () => {
  it('é o provedor do ambiente, não simulado e com estoque (por cliente)', () => {
    expect(erpProvider).toBeInstanceOf(HibridoErpProvider);
    expect(erpProvider.simulado).toBe(false);
    expect(erpProvider.estoqueDisponivel).toBe(true);
  });

  it('fonteDoCliente: notas, simulado ou nenhuma', async () => {
    await expect(erpService.fonteDoCliente({ cnpj: CNPJ_NF_2455, erpId: ERP_ID_COM_VENDAS })).resolves.toBe(
      'simulado',
    );
    await expect(erpService.fonteDoCliente({ cnpj: CNPJ_B, erpId: null })).resolves.toBe('notas');
    await expect(erpService.fonteDoCliente({ cnpj: CNPJ_C, erpId: null })).resolves.toBe('nenhuma');
  });
});

describe('GET /clients/:id/erp (hibrido)', () => {
  it('cliente A (erpId, sem nota): dados simulados, com estoque e sem lista de vendas', async () => {
    const res = await autenticado(`/clients/${clienteA}/erp`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'OK',
      simulado: false,
      ultimasVendas: [],
      estoqueIndisponivel: false,
    });
    expect(res.body.estoque).not.toBeNull();
    expect(res.body.ultimaVenda).not.toBeNull();
  });

  it('cliente B (nota, sem erpId): as notas, sem estoque', async () => {
    const res = await autenticado(`/clients/${clienteB}/erp`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'OK',
      simulado: false,
      estoque: null,
      estoqueIndisponivel: true,
    });
    expect(res.body.ultimasVendas[0].origem).toEqual({ tipo: 'nota', numero: '3001' });
    expect(res.body.ultimaVenda.valor).toBe(VALOR_NOTA_B);
  });

  it('cliente C (sem erpId e sem nota): SEM_ERP_ID na ficha e nos insights', async () => {
    const ficha = await autenticado(`/clients/${clienteC}/erp`);
    const insights = await autenticado(`/clients/${clienteC}/insights`);

    expect(ficha.status).toBe(200);
    expect(ficha.body).toEqual({ status: 'SEM_ERP_ID' });
    expect(insights.status).toBe(200);
    expect(insights.body).toEqual({ status: 'SEM_ERP_ID' });
  });

  it('nota importada para o CNPJ de A troca a fonte na hora: só a nota, sem venda simulada nem estoque', async () => {
    const importacao = await request(app)
      .post('/erp/importacoes?nome=nf-2455.pdf')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4 simulado'));
    expect(importacao.status).toBe(201);

    const res = await autenticado(`/clients/${clienteA}/erp`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'OK', estoque: null, estoqueIndisponivel: true });
    expect(res.body.ultimasVendas).toHaveLength(1);
    expect(res.body.ultimasVendas[0]).toMatchObject({
      data: '2026-11-04',
      valor: VALOR_NF_2455,
      origem: { tipo: 'nota', numero: '2455' },
    });
    expect(res.body.ultimaVenda.valor).toBe(VALOR_NF_2455);
  });
});

describe('GET /erp/produtos (hibrido)', () => {
  it('produtos: o catálogo aprendido das notas (ErpProduct)', async () => {
    await prisma.erpProduct.create({ data: { codigo: '1001', nome: 'Bombom trufado ao leite', precoUnitario: 48.05 } });

    const res = await autenticado('/erp/produtos');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ sku: '1001', nome: 'Bombom trufado ao leite', precoUnitario: 48.05 }]);
    await expect(erpService.buscarProduto('1001')).resolves.toEqual({
      sku: '1001',
      nome: 'Bombom trufado ao leite',
      precoUnitario: 48.05,
    });
  });
});

describe('GET /dashboard/kpis (hibrido)', () => {
  it('consulta o lote com as chaves compostas dos três clientes', async () => {
    const res = await autenticado('/dashboard/kpis');

    expect(res.status).toBe(200);
    expect(res.body.clientesAtivos).toBe(3);
    expect(res.body.simulado).toBe(false);
  });
});

describe('GET /insights/manager-alerts (hibrido)', () => {
  it('com Natal no horizonte: o cliente com notas entra no lote sem alerta nem indisponibilidade', async () => {
    // Data fixa: o estoque do mock de `10865` tem item BAIXO de Natal de 05 a 26/11/2026.
    await ativarDataDeDemonstracao('2026-11-15');
    await prisma.seasonalEvent.create({
      data: {
        nome: 'Natal teste',
        chave: 'NATAL',
        dataInicio: new Date('2026-11-25T12:00:00.000Z'),
        dataFim: new Date('2026-12-25T12:00:00.000Z'),
        produtosSugeridos: ['caixas presente', 'bombons sortidos'],
      },
    });
    /** Simulado com estoque baixo de Natal calibrado (Empório do Vale Brusque). */
    const clienteD = await criarCliente('11222333000343', 'Empório D', ERP_ID_COM_ESTOQUE_BAIXO_DE_NATAL);

    const res = await autenticado('/insights/manager-alerts');

    expect(res.status).toBe(200);
    expect(res.body.eventos).toHaveLength(1);
    // A, B, C e D: no híbrido a chave composta existe para todo cliente ativo.
    expect(res.body.clientesConsultados).toBe(4);
    expect(res.body.clientesIndisponiveis).toBe(0);
    expect(res.body.estoqueIndisponivel).toBe(false);
    const clientesNosAlertas = (res.body.alertas as { clientes: { id: string }[] }[]).flatMap((alerta) =>
      alerta.clientes.map((cliente) => cliente.id),
    );
    expect(clientesNosAlertas).toContain(clienteD);
    expect(clientesNosAlertas).not.toContain(clienteB);
    expect(clientesNosAlertas).not.toContain(clienteC);
  });
});
