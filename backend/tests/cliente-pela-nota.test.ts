import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

/**
 * Cliente pela nota fiscal: o gestor vê os CNPJs das notas `SEM_CLIENTE`
 * agrupados (`GET /erp/sem-cliente`) e cria o cliente com os dados da DANFE
 * na carteira de um representante (`POST /erp/sem-cliente/:cnpj/cliente`).
 */

// O extrator (pdf.js num worker) é trocado pelas linhas do fixture.
jest.mock('../src/services/importacao-nf/pdf-texto', () => ({ extrairTextoDoPdf: jest.fn() }));
const extrairMock = jest.mocked(extrairTextoDoPdf);

const SENHA_PADRAO = 'chokocrm123';
const CNPJ_NF = '25382906000149';
const CNPJ_OUTRO = '11222333000181';
const LINHAS_NF_2455 = readFileSync(join(__dirname, 'fixtures', 'danfe-2455.txt'), 'utf8').split(/\r?\n/);
const CHAVE_2455 = '42261141887017000190550010000024551844654424';
const CHAVE_2456 = '42261141887017000190550010000024561844654425';
/** "Agora" fixo: 05/11/2026 ao meio-dia de São Paulo (15:00Z), longe da virada do dia. */
const AGORA = new Date('2026-11-05T15:00:00.000Z');

let tokenGestor: string;
let tokenRep: string;
let representanteId: string;
let gestorId: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
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

function simularPdf(...paginas: string[][]): void {
  extrairMock.mockResolvedValue(paginas.map((linhas, i) => ({ numero: i + 1, linhas })));
}

function importar() {
  return request(app)
    .post('/erp/importacoes?nome=notas.pdf')
    .set('Authorization', `Bearer ${tokenGestor}`)
    .set('Content-Type', 'application/pdf')
    .send(Buffer.from('%PDF-1.4 simulado'));
}

function listar(token = tokenGestor) {
  return request(app).get('/erp/sem-cliente').set('Authorization', `Bearer ${token}`);
}

function criar(cnpj: string, corpo: Record<string, unknown>, token = tokenGestor) {
  return request(app).post(`/erp/sem-cliente/${cnpj}/cliente`).set('Authorization', `Bearer ${token}`).send(corpo);
}

let sequencial = 0;

/** Nota gravada direto no banco, sem cliente (como a importação grava um CNPJ desconhecido). */
async function criarNota(dados: {
  cnpj: string;
  nome: string;
  dataEmissao: string;
  endereco?: string | null;
  municipio?: string | null;
  clientId?: string | null;
}): Promise<string> {
  sequencial += 1;
  const importacao = await prisma.erpImport.create({
    data: {
      userId: gestorId,
      nomeArquivo: 'notas.pdf',
      notasImportadas: 1,
      notasIgnoradas: 0,
      vinculadasAutomaticamente: 0,
      pendentes: 0,
      cnpjsSemCliente: [],
    },
  });
  const nota = await prisma.erpSale.create({
    data: {
      chaveAcesso: String(sequencial).padStart(44, '9'),
      numero: String(1000 + sequencial),
      serie: '1',
      dataEmissao: new Date(`${dados.dataEmissao}T00:00:00.000Z`),
      naturezaOperacao: 'VENDA',
      destinatarioCnpj: dados.cnpj,
      destinatarioNome: dados.nome,
      destinatarioEndereco: dados.endereco ?? null,
      destinatarioBairro: null,
      destinatarioCep: null,
      destinatarioMunicipio: dados.municipio ?? null,
      destinatarioUf: 'SC',
      destinatarioTelefone: null,
      clientId: dados.clientId ?? null,
      valorProdutos: 100,
      desconto: 0,
      valorTotal: 100,
      importId: importacao.id,
      vinculoStatus: dados.clientId ? 'SEM_VISITA' : 'SEM_CLIENTE',
    },
  });
  return nota.id;
}

async function criarClienteNoBanco(cnpj: string): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Cadastrado pelo app Ltda',
      nomeFantasia: 'Cadastrado pelo app',
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

beforeAll(() => {
  fixarRelogio(AGORA);
});

beforeEach(async () => {
  await truncateAllTables();
  extrairMock.mockReset();
  simularPdf(LINHAS_NF_2455, variante(LINHAS_NF_2455, { chave: CHAVE_2456, numero: '2456' }));
  sequencial = 0;

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const gestor = await prisma.user.create({
    data: { nome: 'Ricardo Menezes', email: 'ricardo.cpn-teste@chokolaten.com.br', role: 'GESTOR', senhaHash },
  });
  gestorId = gestor.id;
  const rep = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', email: 'eduarda.cpn-teste@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
  });
  representanteId = rep.id;
  tokenGestor = await logar('ricardo.cpn-teste@chokolaten.com.br');
  tokenRep = await logar('eduarda.cpn-teste@chokolaten.com.br');
});

afterAll(async () => {
  liberarRelogio();
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /erp/sem-cliente', () => {
  it('lista os CNPJs sem cliente agrupados, com contagem e última emissão', async () => {
    await criarNota({ cnpj: CNPJ_OUTRO, nome: 'MERCADO SOLO LTDA', dataEmissao: '2026-11-04', municipio: 'Blumenau' });
    await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO ANTIGO', dataEmissao: '2026-10-20', endereco: 'RUA VELHA, 1' });
    await criarNota({
      cnpj: CNPJ_NF,
      nome: 'DON GIACOMO PIZZARIA LTDA',
      dataEmissao: '2026-11-03',
      endereco: 'RUA BOA VISTA, 80',
      municipio: 'Pomerode',
    });
    await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO ANTIGO', dataEmissao: '2026-10-25', endereco: 'RUA VELHA, 1' });
    // Nota de cliente cadastrado não entra.
    const clienteId = await criarClienteNoBanco('99888777000166');
    await criarNota({ cnpj: '99888777000166', nome: 'COM CLIENTE', dataEmissao: '2026-11-05', clientId: clienteId });

    const res = await listar();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        cnpj: CNPJ_OUTRO,
        razaoSocial: 'MERCADO SOLO LTDA',
        endereco: null,
        bairro: null,
        cep: null,
        municipio: 'Blumenau',
        uf: 'SC',
        telefone: null,
        notas: 1,
        ultimaEmissao: '2026-11-04',
      },
      {
        cnpj: CNPJ_NF,
        razaoSocial: 'DON GIACOMO PIZZARIA LTDA',
        endereco: 'RUA BOA VISTA, 80',
        bairro: null,
        cep: null,
        municipio: 'Pomerode',
        uf: 'SC',
        telefone: null,
        notas: 3,
        ultimaEmissao: '2026-11-03',
      },
    ]);
  });
});

describe('POST /erp/sem-cliente/:cnpj/cliente', () => {
  it('cria o cliente com os dados da nota, na carteira escolhida, sem e-mail e sem contatos, e liga as notas', async () => {
    const importacao = await importar();
    expect(importacao.status).toBe(201);
    expect(importacao.body.notas.map((n: { vinculo: string }) => n.vinculo)).toEqual(['SEM_CLIENTE', 'SEM_CLIENTE']);

    const res = await criar(CNPJ_NF, { representanteId });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      razaoSocial: 'DON GIACOMO PIZZARIA LTDA',
      nomeFantasia: 'DON GIACOMO PIZZARIA LTDA',
      cnpj: CNPJ_NF,
      cidade: 'Pomerode',
      endereco: 'RUA BOA VISTA, 80 - CENTRO, Pomerode/SC',
      telefone: '(47)3387-5820',
      email: null,
      erpId: null,
      recorrenciaDias: 15,
      contatos: [],
      representante: { id: representanteId, nome: 'Eduarda Fischer' },
    });
    expect(res.body.criadoEm.slice(0, 10)).toBe('2026-11-05');

    const notas = await prisma.erpSale.findMany({ where: { destinatarioCnpj: CNPJ_NF } });
    expect(notas).toHaveLength(2);
    for (const nota of notas) {
      expect(nota.clientId).toBe(res.body.id);
      expect(nota.vinculoStatus).toBe('SEM_VISITA');
    }

    const lista = await listar();
    expect(lista.body.data).toEqual([]);
  });

  it('nome fantasia e recorrência informados valem; ausentes caem na razão social e 15', async () => {
    await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO PIZZARIA LTDA', dataEmissao: '2026-11-03' });
    await criarNota({ cnpj: CNPJ_OUTRO, nome: 'MERCADO SOLO LTDA', dataEmissao: '2026-11-04' });

    const comDados = await criar(CNPJ_NF, { representanteId, nomeFantasia: 'Don Giacomo', recorrenciaDias: 30 });
    expect(comDados.status).toBe(201);
    expect(comDados.body).toMatchObject({ nomeFantasia: 'Don Giacomo', recorrenciaDias: 30 });

    const semDados = await criar(CNPJ_OUTRO, { representanteId });
    expect(semDados.status).toBe(201);
    expect(semDados.body).toMatchObject({
      nomeFantasia: 'MERCADO SOLO LTDA',
      recorrenciaDias: 15,
      // Sem endereço, bairro e município: sobra só a UF, sem separadores soltos.
      endereco: 'SC',
      cidade: '',
      telefone: '',
    });

    const invalido = await criar(CNPJ_OUTRO, { representanteId, nomeFantasia: '', recorrenciaDias: 400 });
    expect(invalido.status).toBe(400);
  });

  it('409 quando já existe cliente com o CNPJ, sem alterar notas', async () => {
    const notaId = await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO PIZZARIA LTDA', dataEmissao: '2026-11-03' });
    // Entre o GET e o POST, o representante cadastrou o mesmo CNPJ pelo app.
    await criarClienteNoBanco(CNPJ_NF);

    const res = await criar(CNPJ_NF, { representanteId });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Já existe um cliente com este CNPJ.');
    const nota = await prisma.erpSale.findUniqueOrThrow({ where: { id: notaId } });
    expect(nota.clientId).toBeNull();
    expect(nota.vinculoStatus).toBe('SEM_CLIENTE');
    expect(await prisma.client.count()).toBe(1);
  });

  it('400 para representante inexistente, inativo ou gestor', async () => {
    await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO PIZZARIA LTDA', dataEmissao: '2026-11-03' });
    const inativo = await prisma.user.create({
      data: {
        nome: 'Inativo',
        email: 'inativo.cpn-teste@chokolaten.com.br',
        role: 'REPRESENTANTE',
        ativo: false,
        senhaHash: 'x',
      },
    });

    for (const id of ['00000000-0000-0000-0000-000000000000', inativo.id, gestorId]) {
      const res = await criar(CNPJ_NF, { representanteId: id });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Representante inválido.');
    }
    expect(await prisma.client.count()).toBe(0);

    const naoUuid = await criar(CNPJ_NF, { representanteId: 'abc' });
    expect(naoUuid.status).toBe(400);
    const cnpjInvalido = await criar('123', { representanteId });
    expect(cnpjInvalido.status).toBe(400);
  });

  it('404 quando não há nota SEM_CLIENTE para o CNPJ', async () => {
    const res = await criar(CNPJ_NF, { representanteId });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Nenhuma nota sem cliente para este CNPJ.');
    expect(await prisma.client.count()).toBe(0);
  });

  it('representante recebe 403 nas duas rotas', async () => {
    await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO PIZZARIA LTDA', dataEmissao: '2026-11-03' });

    expect((await listar(tokenRep)).status).toBe(403);
    expect((await criar(CNPJ_NF, { representanteId }, tokenRep)).status).toBe(403);
    expect(await prisma.client.count()).toBe(0);
  });

  it('reimportar a nota depois do cliente criado mantém o cliente e atualiza o endereço', async () => {
    await importar();
    const criado = await criar(CNPJ_NF, { representanteId });
    expect(criado.status).toBe(201);

    simularPdf(LINHAS_NF_2455.map((l) => l.replace('RUA BOA VISTA, 80', 'RUA NOVA, 99')));
    const reimportacao = await importar();

    expect(reimportacao.status).toBe(201);
    expect(reimportacao.body.cnpjsSemCliente).toEqual([]);
    const nota = await prisma.erpSale.findUniqueOrThrow({ where: { chaveAcesso: CHAVE_2455 } });
    expect(nota.clientId).toBe(criado.body.id);
    expect(nota.vinculoStatus).toBe('SEM_VISITA');
    expect(nota.destinatarioEndereco).toBe('RUA NOVA, 99');
    expect(await prisma.client.count()).toBe(1);
  });

  it('GET /clients/:id do cliente criado devolve email null e contatos vazios; PUT aceita email null', async () => {
    await criarNota({ cnpj: CNPJ_NF, nome: 'DON GIACOMO PIZZARIA LTDA', dataEmissao: '2026-11-03' });
    const criado = await criar(CNPJ_NF, { representanteId });
    const id: string = criado.body.id;

    const ficha = await request(app).get(`/clients/${id}`).set('Authorization', `Bearer ${tokenRep}`);
    expect(ficha.status).toBe(200);
    expect(ficha.body).toMatchObject({ email: null, contatos: [] });

    const comEmail = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${tokenRep}`)
      .send({ email: 'contato@dongiacomo.com.br' });
    expect(comEmail.status).toBe(200);
    expect(comEmail.body.email).toBe('contato@dongiacomo.com.br');

    const semEmail = await request(app)
      .put(`/clients/${id}`)
      .set('Authorization', `Bearer ${tokenRep}`)
      .send({ email: null });
    expect(semEmail.status).toBe(200);
    expect(semEmail.body.email).toBeNull();

    const lista = await request(app).get('/clients').set('Authorization', `Bearer ${tokenRep}`);
    expect(lista.status).toBe(200);
    expect(lista.body.data).toHaveLength(1);
  });
});
