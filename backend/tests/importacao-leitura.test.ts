import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import { truncateAllTables } from './helpers/db';

// O extrator (pdf.js num worker) é trocado pelas linhas do fixture, como em importacao-nf.test.ts.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);

const SENHA_PADRAO = 'chokocrm123';
const CNPJ_NF = '25382906000149';
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);
const CHAVE_2455 = '42261141887017000190550010000024551844654424';

let tokenGestor: string;
let tokenRep: string;
let clienteId: string;

async function logar(usuario: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_PADRAO });
  return login.body.token;
}

function simularPdf(...paginas: string[][]): void {
  extrairMock.mockResolvedValue(paginas.map((linhas, i) => ({ numero: i + 1, linhas })));
}

function ler(token: string, contentType = 'application/pdf') {
  return request(app)
    .post('/erp/importacoes/leitura?nome=notas.pdf')
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', contentType)
    .send(Buffer.from('%PDF-1.4 simulado'));
}

function importar(token: string) {
  return request(app)
    .post('/erp/importacoes?nome=notas.pdf')
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/pdf')
    .send(Buffer.from('%PDF-1.4 simulado'));
}

async function contagens() {
  return {
    vendas: await prisma.erpSale.count(),
    importacoes: await prisma.erpImport.count(),
    produtos: await prisma.erpProduct.count(),
  };
}

beforeEach(async () => {
  await truncateAllTables();
  extrairMock.mockReset();
  simularPdf(LINHAS_NF_2455);

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', usuario: 'ricardo.leitura', role: 'GESTOR', senhaHash },
  });
  const rep = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', usuario: 'eduarda.leitura', role: 'REPRESENTANTE', senhaHash },
  });
  tokenGestor = await logar('ricardo.leitura');
  tokenRep = await logar('eduarda.leitura');
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Don Giacomo Ltda',
      nomeFantasia: 'Don Giacomo',
      cnpj: CNPJ_NF,
      cidade: 'Pomerode',
      endereco: 'Rua Boa Vista, 80',
      telefone: '(47) 3387-5820',
      email: 'contato@exemplo.com.br',
      representanteId: rep.id,
    },
  });
  clienteId = cliente.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /erp/importacoes/leitura', () => {
  it('lê a nota de cliente cadastrado sem gravar nada', async () => {
    const antes = await contagens();

    const res = await ler(tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.ignoradas).toEqual([]);
    expect(res.body.notas).toHaveLength(1);
    const nota = res.body.notas[0];
    expect(nota).toMatchObject({
      chaveAcesso: CHAVE_2455,
      numero: '2455',
      serie: '1',
      cliente: { id: clienteId, nomeFantasia: 'Don Giacomo' },
      jaImportada: false,
    });
    expect(nota.dataEmissao).toBe('2026-11-04');
    expect(nota.itens.length).toBeGreaterThan(0);
    expect(nota.itens[0]).toEqual({
      codigo: expect.any(String),
      descricao: expect.any(String),
      quantidade: expect.any(Number),
      precoUnitario: expect.any(Number),
      valorTotal: expect.any(Number),
    });
    expect(await contagens()).toEqual(antes);
  });

  it('marca jaImportada depois que a nota foi importada', async () => {
    expect((await importar(tokenGestor)).status).toBe(201);

    const res = await ler(tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.notas[0].jaImportada).toBe(true);
  });

  it('devolve cliente null quando o CNPJ não tem cliente', async () => {
    await prisma.client.delete({ where: { id: clienteId } });

    const res = await ler(tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.notas[0].cliente).toBeNull();
  });

  it('responde 400 quando o PDF não é uma DANFE', async () => {
    simularPdf(['Qualquer outro documento']);

    const res = await ler(tokenGestor);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Não encontrei uma DANFE legível neste PDF.');
  });

  it('responde 415 com Content-Type diferente de application/pdf', async () => {
    const res = await ler(tokenGestor, 'text/plain');
    expect(res.status).toBe(415);
  });

  it('responde 403 para o representante', async () => {
    const res = await ler(tokenRep);
    expect(res.status).toBe(403);
  });
});
