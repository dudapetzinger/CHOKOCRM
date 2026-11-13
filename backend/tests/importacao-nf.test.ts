import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import { truncateAllTables } from './helpers/db';

// O extrator (pdf.js num worker) é trocado pelas linhas do fixture; só o teste
// do caminho feliz usa o extrator de verdade, com um PDF gerado pelo pdfkit.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);
const extrairReal = (
  jest.requireActual('../src/services/importacao-nf/pdf-texto') as {
    extrairTextoDoPdf: typeof extrairTextoDoPdf;
  }
).extrairTextoDoPdf;

const SENHA_PADRAO = 'chokocrm123';
const CNPJ_NF = '25382906000149';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);
const CHAVE_2455 = '42261141887017000190550010000024551844654424';
const CHAVE_2456 = '42261141887017000190550010000024561844654425';
/** 04/11/2026 12:00 em São Paulo: mesmo dia da emissão da NF 2455. */
const DIA_DA_NOTA = new Date('2026-11-04T15:00:00.000Z');
const DIA_ANTERIOR = new Date('2026-11-03T15:00:00.000Z');

let tokenGestor: string;
let tokenRep: string;
let representanteId: string;
let clienteId: string;

async function logar(usuario: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarCliente(cnpj: string, nomeFantasia: string): Promise<string> {
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
    },
  });
  return cliente.id;
}

async function criarVisita(dataHora: Date, resultado: 'VENDA' | 'NEGOCIACAO' | 'SEM_VENDA' = 'NEGOCIACAO') {
  return prisma.visit.create({
    data: {
      clientId: clienteId,
      userId: representanteId,
      dataHora,
      descricao: 'Visita de teste',
      resultado,
      itens: { create: [{ sku: 'ANT0001', produtoNome: 'Item digitado', quantidade: 3, precoUnitario: 10 }] },
    },
  });
}

/** Cópia da NF 2455 com outra chave e outro número (o leitor não confere o dígito verificador). */
function variante(linhas: string[], { chave, numero }: { chave: string; numero: string }): string[] {
  const chaveComEspacos = chave.replace(/(\d{4})(?=\d)/g, '$1 ');
  return linhas.map((l) =>
    l
      .replace('4226 1141 8870 1700 0190 5500 1000 0024 5518 4465 4424', chaveComEspacos)
      .replace('NÚMERO 2455', `NÚMERO ${numero}`)
      .replace('Nº 2455', `Nº ${numero}`),
  );
}

function trocar(linhas: string[], de: string, para: string): string[] {
  return linhas.map((l) => l.replace(de, para));
}

function simularPdf(...paginas: string[][]): void {
  extrairMock.mockResolvedValue(paginas.map((linhas, i) => ({ numero: i + 1, linhas })));
}

function importar(token: string, nome = 'notas.pdf') {
  return request(app)
    .post(`/erp/importacoes?nome=${encodeURIComponent(nome)}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', 'application/pdf')
    .send(Buffer.from('%PDF-1.4 simulado'));
}

function gerarPdf(linhas: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(7);
    linhas.forEach((linha, i) => doc.text(linha, 10, 10 + i * 11, { lineBreak: false }));
    doc.end();
  });
}

beforeEach(async () => {
  await truncateAllTables();
  extrairMock.mockReset();
  simularPdf(LINHAS_NF_2455);

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', usuario: 'ricardo.nf-teste', role: 'GESTOR', senhaHash },
  });
  const rep = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', usuario: 'eduarda.nf-teste', role: 'REPRESENTANTE', senhaHash },
  });
  representanteId = rep.id;
  tokenGestor = await logar('ricardo.nf-teste');
  tokenRep = await logar('eduarda.nf-teste');
  clienteId = await criarCliente(CNPJ_NF, 'Don Giacomo');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /erp/importacoes', () => {
  it('importa a NF 2455 e vincula sozinha à visita do mesmo dia', async () => {
    const visita = await criarVisita(DIA_DA_NOTA);

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nomeArquivo: 'notas.pdf',
      autor: { nome: 'Ricardo Menezes' },
      ignoradas: [],
      cnpjsSemCliente: [],
    });
    expect(res.body.notas).toHaveLength(1);
    const nota = res.body.notas[0];
    expect(nota).toMatchObject({
      chaveAcesso: CHAVE_2455,
      numero: '2455',
      serie: '1',
      dataEmissao: '2026-11-04',
      destinatarioNome: 'DON GIACOMO PIZZARIA LTDA',
      destinatarioCnpj: CNPJ_NF,
      cliente: { id: clienteId, nomeFantasia: 'Don Giacomo' },
      valorProdutos: 1634,
      desconto: 104.02,
      valorTotal: 1529.98,
      vinculo: 'AUTOMATICO',
      visitaVinculadaId: visita.id,
    });
    expect(nota.itens).toEqual([
      { codigo: 'BAR0019', descricao: 'BARRA AO LEITE 35% 500 G', quantidade: 16, precoUnitario: 59, valorTotal: 944 },
      { codigo: 'BAR0016', descricao: 'BARRA BRANCO 500 G', quantidade: 10, precoUnitario: 69, valorTotal: 690 },
    ]);

    expect(await prisma.erpSale.count()).toBe(1);
    expect(await prisma.erpSaleItem.count()).toBe(2);
    expect(await prisma.erpProduct.count()).toBe(2);
    const importacao = await prisma.erpImport.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(importacao).toMatchObject({
      notasImportadas: 1,
      notasIgnoradas: 0,
      vinculadasAutomaticamente: 1,
      pendentes: 0,
    });

    const visitaDepois = await prisma.visit.findUniqueOrThrow({ where: { id: visita.id }, include: { itens: true } });
    expect(visitaDepois.erpSaleId).toBe(nota.id);
    expect(visitaDepois.resultado).toBe('VENDA');
    expect(
      visitaDepois.itens.map((i) => [i.sku, i.produtoNome, i.quantidade, Number(i.precoUnitario)]).sort(),
    ).toEqual([
      ['BAR0016', 'BARRA BRANCO 500 G', 10, 69],
      ['BAR0019', 'BARRA AO LEITE 35% 500 G', 16, 59],
    ]);
  });

  it('lê um PDF de verdade (pdfkit + pdf.js) de ponta a ponta', async () => {
    const pdf = await gerarPdf(LINHAS_NF_2455);
    extrairMock.mockImplementationOnce(extrairReal);

    const res = await request(app)
      .post('/erp/importacoes?nome=nf-2455.pdf')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .set('Content-Type', 'application/pdf')
      .send(pdf);

    expect(res.status).toBe(201);
    expect(res.body.notas).toHaveLength(1);
    expect(res.body.notas[0]).toMatchObject({ chaveAcesso: CHAVE_2455, valorTotal: 1529.98, vinculo: 'SEM_VISITA' });
    expect(res.body.notas[0].itens).toHaveLength(2);
  });

  it('deixa pendente, com a visita sugerida, quando a última visita é de outro dia', async () => {
    const visita = await criarVisita(DIA_ANTERIOR, 'SEM_VENDA');

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    const nota = res.body.notas[0];
    expect(nota.vinculo).toBe('PENDENTE');
    expect(nota.visitaVinculadaId).toBeNull();
    expect(nota.visitaSugerida).toMatchObject({ id: visita.id, resultado: 'SEM_VENDA', totalPedido: 30 });
    expect(new Date(nota.visitaSugerida.dataHora).toISOString()).toBe(DIA_ANTERIOR.toISOString());
    const intacta = await prisma.visit.findUniqueOrThrow({ where: { id: visita.id }, include: { itens: true } });
    expect(intacta.erpSaleId).toBeNull();
    expect(intacta.itens).toHaveLength(1);
    expect(intacta.resultado).toBe('SEM_VENDA');
  });

  it('usa a visita mais recente, de qualquer resultado', async () => {
    await criarVisita(DIA_ANTERIOR, 'VENDA');
    const recente = await criarVisita(DIA_DA_NOTA, 'SEM_VENDA');

    const res = await importar(tokenGestor);

    expect(res.body.notas[0]).toMatchObject({ vinculo: 'AUTOMATICO', visitaVinculadaId: recente.id });
  });

  it('cliente sem visita: SEM_VISITA', async () => {
    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body.notas[0]).toMatchObject({ vinculo: 'SEM_VISITA', visitaSugerida: null, visitaVinculadaId: null });
  });

  it('CNPJ sem cliente: SEM_CLIENTE e lista em cnpjsSemCliente', async () => {
    await prisma.client.delete({ where: { id: clienteId } });

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body.notas[0]).toMatchObject({ vinculo: 'SEM_CLIENTE', cliente: null });
    expect(res.body.cnpjsSemCliente).toEqual([{ cnpj: CNPJ_NF, razaoSocial: 'DON GIACOMO PIZZARIA LTDA' }]);
  });

  it('grava o endereço do destinatário e a reimportação atualiza os campos', async () => {
    const primeira = await importar(tokenGestor);
    expect(primeira.status).toBe(201);
    expect(primeira.body.notas[0].destinatario).toEqual({
      endereco: 'RUA BOA VISTA, 80',
      bairro: 'CENTRO',
      cep: '89107-000',
      municipio: 'Pomerode',
      uf: 'SC',
      telefone: '(47)3387-5820',
    });
    const gravada = await prisma.erpSale.findUniqueOrThrow({ where: { chaveAcesso: CHAVE_2455 } });
    expect(gravada).toMatchObject({
      destinatarioEndereco: 'RUA BOA VISTA, 80',
      destinatarioBairro: 'CENTRO',
      destinatarioCep: '89107-000',
      destinatarioMunicipio: 'Pomerode',
      destinatarioUf: 'SC',
      destinatarioTelefone: '(47)3387-5820',
    });

    simularPdf(trocar(LINHAS_NF_2455, '(47)3387-5820', '(47)3399-1234'));
    const segunda = await importar(tokenGestor, 'de-novo.pdf');

    expect(segunda.status).toBe(201);
    expect(await prisma.erpSale.count()).toBe(1);
    const atualizada = await prisma.erpSale.findUniqueOrThrow({ where: { chaveAcesso: CHAVE_2455 } });
    expect(atualizada.destinatarioTelefone).toBe('(47)3399-1234');
    expect(atualizada.destinatarioMunicipio).toBe('Pomerode');
  });

  it('reimportar atualiza a nota sem duplicar, mantém o vínculo e atualiza os itens da visita', async () => {
    const visita = await criarVisita(DIA_DA_NOTA);
    const primeira = await importar(tokenGestor);
    expect(primeira.body.notas[0].vinculo).toBe('AUTOMATICO');

    // Mesma chave, mas a quantidade do primeiro item agora é 20 (1.180 + 690).
    let editada = trocar(LINHAS_NF_2455, '16,0000 59,00 944,00', '20,0000 59,00 1.180,00');
    editada = trocar(editada, 'R$ 1.634,00', 'R$ 1.870,00');
    editada = trocar(editada, 'R$ 1.529,98', 'R$ 1.765,98');
    simularPdf(editada);
    const segunda = await importar(tokenGestor, 'de-novo.pdf');

    expect(segunda.status).toBe(201);
    expect(segunda.body.notas).toHaveLength(1);
    expect(segunda.body.notas[0]).toMatchObject({
      id: primeira.body.notas[0].id,
      vinculo: 'AUTOMATICO',
      visitaVinculadaId: visita.id,
      valorProdutos: 1870,
    });
    expect(segunda.body.notas[0].itens[0]).toMatchObject({ codigo: 'BAR0019', quantidade: 20, valorTotal: 1180 });
    expect(await prisma.erpSale.count()).toBe(1);
    expect(await prisma.erpSaleItem.count()).toBe(2);
    expect(await prisma.erpProduct.count()).toBe(2);
    const itens = await prisma.visitItem.findMany({ where: { visitId: visita.id }, orderBy: { sku: 'asc' } });
    expect(itens.map((i) => [i.sku, i.quantidade])).toEqual([
      ['BAR0016', 10],
      ['BAR0019', 20],
    ]);
    const visitaDepois = await prisma.visit.findUniqueOrThrow({ where: { id: visita.id } });
    expect(visitaDepois.erpSaleId).toBe(primeira.body.notas[0].id);
  });

  it('duas notas do mesmo cliente no mesmo dia: só a primeira vincula, a segunda fica pendente', async () => {
    const visita = await criarVisita(DIA_DA_NOTA);
    const segundaNota = variante(LINHAS_NF_2455, { chave: CHAVE_2456, numero: '2456' });
    simularPdf(LINHAS_NF_2455, segundaNota);

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body.notas).toHaveLength(2);
    const [primeira, segunda] = res.body.notas;
    expect(primeira).toMatchObject({ numero: '2455', vinculo: 'AUTOMATICO', visitaVinculadaId: visita.id });
    expect(segunda).toMatchObject({ numero: '2456', vinculo: 'PENDENTE', visitaVinculadaId: null });
    expect(segunda.visitaSugerida.id).toBe(visita.id);
    expect(await prisma.erpSale.count()).toBe(2);
    const importacao = await prisma.erpImport.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(importacao).toMatchObject({ notasImportadas: 2, vinculadasAutomaticamente: 1, pendentes: 1 });
    // A visita já tem nota: vincular a segunda a ela é conflito.
    const vinculo = await request(app)
      .post(`/erp/vendas/${segunda.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: visita.id });
    expect(vinculo.status).toBe(409);
    expect(vinculo.body.error.message).toBe('Esta visita já tem uma nota vinculada.');
  });

  it('quantidade fracionária: ErpSaleItem guarda o decimal e VisitItem um inteiro de no mínimo 1', async () => {
    const visita = await criarVisita(DIA_DA_NOTA);
    let fracionada = trocar(LINHAS_NF_2455, '16,0000 59,00 944,00', '0,5000 59,00 29,50');
    fracionada = trocar(fracionada, 'R$ 1.634,00', 'R$ 719,50');
    fracionada = trocar(fracionada, 'R$ 1.529,98', 'R$ 615,48');
    simularPdf(fracionada);

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body.notas[0].vinculo).toBe('AUTOMATICO');
    expect(res.body.notas[0].itens[0]).toMatchObject({ codigo: 'BAR0019', quantidade: 0.5 });
    const itemDaNota = await prisma.erpSaleItem.findFirstOrThrow({ where: { produtoCodigo: 'BAR0019' } });
    expect(Number(itemDaNota.quantidade)).toBe(0.5);
    const itemDaVisita = await prisma.visitItem.findFirstOrThrow({ where: { visitId: visita.id, sku: 'BAR0019' } });
    expect(itemDaVisita.quantidade).toBe(1);
  });

  it('PDF sem nenhuma DANFE reconhecida: 400 com a mensagem', async () => {
    simularPdf(['Qualquer coisa que não é uma nota']);

    const res = await importar(tokenGestor);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Não encontrei uma DANFE legível neste PDF.',
    });
    expect(await prisma.erpImport.count()).toBe(0);
  });

  it('PDF que o leitor não consegue abrir: 400 com a mesma mensagem', async () => {
    extrairMock.mockRejectedValue(new Error('Invalid PDF structure'));

    const res = await importar(tokenGestor);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Não encontrei uma DANFE legível neste PDF.');
  });

  it('sem corpo ou com outro tipo de arquivo: 400/415', async () => {
    const vazio = await request(app)
      .post('/erp/importacoes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(0));
    expect(vazio.status).toBe(400);

    const texto = await request(app)
      .post('/erp/importacoes')
      .set('Authorization', `Bearer ${tokenGestor}`)
      .set('Content-Type', 'text/plain')
      .send('oi');
    expect(texto.status).toBe(415);
  });

  it('representante: 403; sem token: 401', async () => {
    expect((await importar(tokenRep)).status).toBe(403);
    const semToken = await request(app)
      .post('/erp/importacoes')
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('x'));
    expect(semToken.status).toBe(401);
  });

  it('conta as notas ignoradas (não são venda) no resultado', async () => {
    const devolucao = readFileSync(join(__dirname, 'fixtures', 'danfe-devolucao.txt'), 'utf8').split(/\r?\n/);
    simularPdf(LINHAS_NF_2455, devolucao);

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body.notas).toHaveLength(1);
    expect(res.body.ignoradas).toHaveLength(1);
    expect(res.body.ignoradas[0].motivo).toEqual(expect.any(String));
    const importacao = await prisma.erpImport.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(importacao.notasIgnoradas).toBe(1);
  });
});

describe('vínculo manual', () => {
  async function notaPendente() {
    const visitaAnterior = await criarVisita(DIA_ANTERIOR, 'NEGOCIACAO');
    const res = await importar(tokenGestor);
    return { visitaAnterior, nota: res.body.notas[0] as { id: string } };
  }

  it('POST /erp/vendas/:id/vinculo vincula, substitui os itens e passa a VENDA', async () => {
    const { visitaAnterior, nota } = await notaPendente();

    const res = await request(app)
      .post(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: visitaAnterior.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: nota.id, vinculo: 'VINCULADA', visitaVinculadaId: visitaAnterior.id });
    const visita = await prisma.visit.findUniqueOrThrow({ where: { id: visitaAnterior.id }, include: { itens: true } });
    expect(visita.erpSaleId).toBe(nota.id);
    expect(visita.resultado).toBe('VENDA');
    expect(visita.itens.map((i) => [i.sku, i.quantidade]).sort()).toEqual([
      ['BAR0016', 10],
      ['BAR0019', 16],
    ]);
  });

  it('DELETE /erp/vendas/:id/vinculo esvazia os itens e marca RECUSADA (veio de pendência)', async () => {
    const { visitaAnterior, nota } = await notaPendente();
    await request(app)
      .post(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: visitaAnterior.id });

    const res = await request(app)
      .delete(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ vinculo: 'RECUSADA', visitaVinculadaId: null });
    const visita = await prisma.visit.findUniqueOrThrow({ where: { id: visitaAnterior.id }, include: { itens: true } });
    expect(visita.erpSaleId).toBeNull();
    expect(visita.itens).toEqual([]);
  });

  it('desvincular uma nota automática a deixa RECUSADA e a reimportação não revincula', async () => {
    const visita = await criarVisita(DIA_DA_NOTA);
    const importada = await importar(tokenGestor);
    const id = importada.body.notas[0].id;

    const res = await request(app).delete(`/erp/vendas/${id}/vinculo`).set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.vinculo).toBe('RECUSADA');
    expect(await prisma.visitItem.count({ where: { visitId: visita.id } })).toBe(0);

    const reimportada = await importar(tokenGestor);

    expect(reimportada.body.notas[0]).toMatchObject({ id, vinculo: 'RECUSADA', visitaVinculadaId: null });
    const depois = await prisma.visit.findUniqueOrThrow({ where: { id: visita.id } });
    expect(depois.erpSaleId).toBeNull();
    expect(await prisma.visitItem.count({ where: { visitId: visita.id } })).toBe(0);
  });

  it('desvincular uma nota vinculada cuja visita foi apagada a deixa RECUSADA', async () => {
    const visita = await criarVisita(DIA_DA_NOTA);
    const importada = await importar(tokenGestor);
    const id = importada.body.notas[0].id;
    expect(importada.body.notas[0].vinculo).toBe('AUTOMATICO');
    await prisma.visitItem.deleteMany({ where: { visitId: visita.id } });
    await prisma.visit.delete({ where: { id: visita.id } });

    const res = await request(app).delete(`/erp/vendas/${id}/vinculo`).set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, vinculo: 'RECUSADA', visitaVinculadaId: null });
    const nota = await prisma.erpSale.findUniqueOrThrow({ where: { id } });
    expect(nota.vinculoStatus).toBe('RECUSADA');
  });

  it('PDF só com notas ignoradas: 201 com notas vazias e uma importação gravada', async () => {
    const devolucao = readFileSync(join(__dirname, 'fixtures', 'danfe-devolucao.txt'), 'utf8').split(/\r?\n/);
    simularPdf(devolucao);

    const res = await importar(tokenGestor);

    expect(res.status).toBe(201);
    expect(res.body.notas).toEqual([]);
    expect(res.body.ignoradas).toHaveLength(1);
    expect(await prisma.erpImport.count()).toBe(1);
    const importacao = await prisma.erpImport.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(importacao).toMatchObject({ notasImportadas: 0, notasIgnoradas: 1 });
  });

  it('recusar uma pendência (DELETE sem visita vinculada) marca RECUSADA e some das pendências', async () => {
    const { nota } = await notaPendente();

    const res = await request(app)
      .delete(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.vinculo).toBe('RECUSADA');
    const pend = await request(app).get('/erp/pendencias').set('Authorization', `Bearer ${tokenGestor}`);
    expect(pend.body.data).toEqual([]);
  });

  it('reimportar uma nota RECUSADA não volta a perguntar', async () => {
    const { nota } = await notaPendente();
    await request(app).delete(`/erp/vendas/${nota.id}/vinculo`).set('Authorization', `Bearer ${tokenGestor}`);

    const res = await importar(tokenGestor);

    expect(res.body.notas[0]).toMatchObject({ id: nota.id, vinculo: 'RECUSADA' });
  });

  it('400 quando a visita é de outro cliente', async () => {
    const { nota } = await notaPendente();
    const outro = await criarCliente('11222333000181', 'Outro Cliente');
    const visitaDeOutro = await prisma.visit.create({
      data: { clientId: outro, userId: representanteId, dataHora: DIA_DA_NOTA, descricao: 'Outra', resultado: 'VENDA' },
    });

    const res = await request(app)
      .post(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: visitaDeOutro.id });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('A visita não é deste cliente.');
  });

  it('404 para nota ou visita inexistente; 400 para visitId inválido', async () => {
    const { nota } = await notaPendente();
    const semNota = await request(app)
      .post(`/erp/vendas/${ID_INEXISTENTE}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: ID_INEXISTENTE });
    expect(semNota.status).toBe(404);
    const semVisita = await request(app)
      .post(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: ID_INEXISTENTE });
    expect(semVisita.status).toBe(404);
    const invalido = await request(app)
      .post(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ visitId: 'abc' });
    expect(invalido.status).toBe(400);
  });

  it('representante: 403 no vínculo e no desvínculo', async () => {
    const { nota } = await notaPendente();
    const post = await request(app)
      .post(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenRep}`)
      .send({ visitId: ID_INEXISTENTE });
    expect(post.status).toBe(403);
    const del = await request(app)
      .delete(`/erp/vendas/${nota.id}/vinculo`)
      .set('Authorization', `Bearer ${tokenRep}`);
    expect(del.status).toBe(403);
  });
});

describe('listagens', () => {
  it('GET /erp/importacoes: mais recentes primeiro, com notas e autor', async () => {
    await importar(tokenGestor, 'primeira.pdf');
    simularPdf(variante(LINHAS_NF_2455, { chave: CHAVE_2456, numero: '2456' }));
    await importar(tokenGestor, 'segunda.pdf');

    const res = await request(app).get('/erp/importacoes').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { nomeArquivo: string }) => i.nomeArquivo)).toEqual(['segunda.pdf', 'primeira.pdf']);
    expect(res.body.data[0]).toMatchObject({ autor: { nome: 'Ricardo Menezes' }, ignoradas: [], cnpjsSemCliente: [] });
    expect(res.body.data[0].notas).toHaveLength(1);
  });

  it('GET /erp/importacoes limita a 20', async () => {
    const gestor = await prisma.user.findFirstOrThrow({ where: { role: 'GESTOR' } });
    await prisma.erpImport.createMany({
      data: Array.from({ length: 22 }, (_, i) => ({
        userId: gestor.id,
        nomeArquivo: `a${i}.pdf`,
        notasImportadas: 0,
        notasIgnoradas: 0,
        vinculadasAutomaticamente: 0,
        pendentes: 0,
        cnpjsSemCliente: [],
      })),
    });

    const res = await request(app).get('/erp/importacoes').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.body.data).toHaveLength(20);
  });

  it('GET /erp/pendencias traz só as PENDENTE, com cliente e visita sugerida', async () => {
    const visita = await criarVisita(DIA_ANTERIOR, 'VENDA');
    await importar(tokenGestor);

    const res = await request(app).get('/erp/pendencias').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      numero: '2455',
      vinculo: 'PENDENTE',
      cliente: { id: clienteId },
      visitaSugerida: { id: visita.id, resultado: 'VENDA', totalPedido: 30 },
    });
  });

  it('representante: 403 nas duas listagens', async () => {
    for (const rota of ['/erp/importacoes', '/erp/pendencias']) {
      const res = await request(app).get(rota).set('Authorization', `Bearer ${tokenRep}`);
      expect(res.status).toBe(403);
    }
  });
});
