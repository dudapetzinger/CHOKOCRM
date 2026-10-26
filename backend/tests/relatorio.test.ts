import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

const SENHA_PADRAO = 'chokocrm123';
/** "Agora" fixo: 26/10/2026 ao meio-dia de São Paulo (15:00Z), longe da virada do dia (`fixarRelogio`). */
const AGORA = new Date('2026-10-26T15:00:00.000Z');
const MILISSEGUNDOS_POR_DIA = 86_400_000;

type Resultado = 'VENDA' | 'SEM_VENDA' | 'NEGOCIACAO';
type Item = { quantidade: number; precoUnitario: string };
type Linha = {
  cliente: string;
  cidade: string;
  representante: string;
  situacao: string;
  diasSemVisita: number | null;
  visitasNoPeriodo: number;
  vendasNoPeriodo: number;
};

let tokenRepresentante: string;
let tokenGestor: string;
let representanteAId: string;
let representanteBId: string;
let cnpjSequencial = 0;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

/** Instante `diasAtras` dias antes de AGORA, ao meio-dia de São Paulo. */
function haDias(diasAtras: number): Date {
  return new Date(AGORA.getTime() - diasAtras * MILISSEGUNDOS_POR_DIA);
}

async function criarCliente(
  nomeFantasia: string,
  cidade: string,
  representanteId: string,
  ativo = true,
): Promise<string> {
  cnpjSequencial += 1;
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Ltda`,
      nomeFantasia,
      cnpj: `112223330${String(cnpjSequencial).padStart(5, '0')}`,
      cidade,
      endereco: 'Rua XV de Novembro, 100',
      telefone: '(47) 3333-0000',
      email: `contato${cnpjSequencial}@cliente.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId: null,
      ativo,
    },
  });
  return cliente.id;
}

async function criarVisita(
  clientId: string,
  userId: string,
  diasAtras: number,
  resultado: Resultado,
  itens: Item[] = [],
): Promise<void> {
  await prisma.visit.create({
    data: {
      clientId,
      userId,
      dataHora: haDias(diasAtras),
      descricao: 'Visita de teste.',
      resultado,
      ...(itens.length > 0
        ? {
            itens: {
              create: itens.map((item, indice) => ({
                sku: `SKU-${indice}`,
                produtoNome: `Produto ${indice}`,
                quantidade: item.quantidade,
                precoUnitario: item.precoUnitario,
              })),
            },
          }
        : {}),
    },
  });
}

function getRelatorio(query: Record<string, string | number> = {}, token = tokenGestor): request.Test {
  return request(app).get('/dashboard/relatorio').query(query).set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  fixarRelogio(AGORA);
});

beforeEach(async () => {
  await truncateAllTables();
  cnpjSequencial = 0;

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const eduarda = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', email: 'eduarda.relatorio@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
  });
  const bruno = await prisma.user.create({
    data: { nome: 'Bruno Alencar', email: 'bruno.relatorio@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
  });
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', email: 'ricardo.relatorio@chokolaten.com.br', role: 'GESTOR', senhaHash },
  });
  representanteAId = eduarda.id;
  representanteBId = bruno.id;

  // Carteira da Eduarda, uma cor de cada e dois nunca visitados (empate pelo nome).
  const doisDias = await criarCliente('Doces da Vovó', 'Joinville', representanteAId);
  await criarVisita(doisDias, representanteAId, 2, 'VENDA', [
    { quantidade: 3, precoUnitario: '27.90' },
    { quantidade: 1, precoUnitario: '0.10' },
    { quantidade: 1, precoUnitario: '0.20' },
  ]);
  await criarVisita(doisDias, representanteAId, 12, 'NEGOCIACAO', [{ quantidade: 5, precoUnitario: '10.00' }]);
  await criarVisita(doisDias, representanteAId, 100, 'VENDA', [{ quantidade: 2, precoUnitario: '50.00' }]);

  const dezDias = await criarCliente('Empório Central', 'Blumenau', representanteAId);
  await criarVisita(dezDias, representanteAId, 10, 'SEM_VENDA');

  const vinteDias = await criarCliente('Padaria Estrela', 'Pomerode', representanteAId);
  await criarVisita(vinteDias, representanteAId, 20, 'NEGOCIACAO');

  const quarentaDias = await criarCliente('Bombons Indaial', 'Indaial', representanteAId);
  await criarVisita(quarentaDias, representanteAId, 40, 'SEM_VENDA');

  await criarCliente('Bazar Nunca', 'Joinville', representanteAId);
  await criarCliente('Armazém Nunca', 'Joinville', representanteAId);

  const inativo = await criarCliente('Cliente Inativo', 'Joinville', representanteAId, false);
  await criarVisita(inativo, representanteAId, 1, 'VENDA', [{ quantidade: 1, precoUnitario: '999.00' }]);

  // Carteira do Bruno: um cliente verde com venda.
  const doBruno = await criarCliente('Chocolates Gaspar', 'Gaspar', representanteBId);
  await criarVisita(doBruno, representanteBId, 3, 'VENDA', [{ quantidade: 4, precoUnitario: '12.50' }]);

  tokenRepresentante = await logar('eduarda.relatorio@chokolaten.com.br');
  tokenGestor = await logar('ricardo.relatorio@chokolaten.com.br');
});

afterAll(async () => {
  liberarRelogio();
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /dashboard/relatorio', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/dashboard/relatorio');

    expect(res.status).toBe(401);
  });

  it.each(['60', 'abc'])('periodoDias=%s responde 400 "Período deve ser 30, 90 ou 365 dias."', async (periodoDias) => {
    const res = await getRelatorio({ periodoDias });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Dados inválidos.');
    expect(res.body.error.details).toEqual([{ path: 'periodoDias', message: 'Período deve ser 30, 90 ou 365 dias.' }]);
  });

  it('representanteId que não é uuid responde 400 "Identificador do representante inválido."', async () => {
    const res = await getRelatorio({ representanteId: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([
      { path: 'representanteId', message: 'Identificador do representante inválido.' },
    ]);
  });

  it('gestor recebe uma linha por cliente ativo, em ordem de urgência, com a situação, as visitas e as vendas do período', async () => {
    const res = await getRelatorio({ periodoDias: 30 });

    expect(res.status).toBe(200);
    const linhas: Linha[] = res.body.data;
    // Nunca visitados à frente (empate pelo nome), depois mais dias sem visita na mesma cor; o inativo não entra.
    expect(linhas).toEqual([
      {
        cliente: 'Armazém Nunca',
        cidade: 'Joinville',
        representante: 'Eduarda Fischer',
        situacao: 'Vermelho',
        diasSemVisita: null,
        visitasNoPeriodo: 0,
        vendasNoPeriodo: 0,
      },
      {
        cliente: 'Bazar Nunca',
        cidade: 'Joinville',
        representante: 'Eduarda Fischer',
        situacao: 'Vermelho',
        diasSemVisita: null,
        visitasNoPeriodo: 0,
        vendasNoPeriodo: 0,
      },
      {
        cliente: 'Bombons Indaial',
        cidade: 'Indaial',
        representante: 'Eduarda Fischer',
        situacao: 'Vermelho',
        diasSemVisita: 40,
        visitasNoPeriodo: 0,
        vendasNoPeriodo: 0,
      },
      {
        cliente: 'Padaria Estrela',
        cidade: 'Pomerode',
        representante: 'Eduarda Fischer',
        situacao: 'Laranja',
        diasSemVisita: 20,
        visitasNoPeriodo: 1,
        vendasNoPeriodo: 0,
      },
      {
        cliente: 'Empório Central',
        cidade: 'Blumenau',
        representante: 'Eduarda Fischer',
        situacao: 'Amarelo',
        diasSemVisita: 10,
        visitasNoPeriodo: 1,
        vendasNoPeriodo: 0,
      },
      {
        cliente: 'Chocolates Gaspar',
        cidade: 'Gaspar',
        representante: 'Bruno Alencar',
        situacao: 'Verde',
        diasSemVisita: 3,
        visitasNoPeriodo: 1,
        vendasNoPeriodo: 50,
      },
      {
        cliente: 'Doces da Vovó',
        cidade: 'Joinville',
        representante: 'Eduarda Fischer',
        situacao: 'Verde',
        diasSemVisita: 2,
        visitasNoPeriodo: 2,
        // Só a VENDA de −2 (3 × 27,90 + 0,10 + 0,20), somada em Decimal; a NEGOCIACAO de −12 não entra.
        vendasNoPeriodo: 84,
      },
    ]);
  });

  it('periodoDias ausente vale 30; 365 inclui a venda de 100 dias atrás', async () => {
    const [padrao, anual] = await Promise.all([getRelatorio(), getRelatorio({ periodoDias: 365 })]);

    const doces = (res: request.Response) => (res.body.data as Linha[]).find((l) => l.cliente === 'Doces da Vovó')!;
    expect(padrao.status).toBe(200);
    expect(doces(padrao)).toMatchObject({ visitasNoPeriodo: 2, vendasNoPeriodo: 84 });
    expect(anual.status).toBe(200);
    expect(doces(anual)).toMatchObject({ visitasNoPeriodo: 3, vendasNoPeriodo: 184 });
  });

  it('aceita 400 dias (a Planilha não tem o teto de 365 do Painel) e período por datas', async () => {
    const hoje = dataCalendario(new Date());
    expect(hoje).toBe('2026-10-26'); // o relógio fixo

    const longo = await getRelatorio({ inicio: somarDias(hoje, -399), fim: hoje });
    const porDatas = await getRelatorio({ inicio: somarDias(hoje, -3), fim: somarDias(hoje, -1) });
    const dosDois = await getRelatorio({ periodoDias: 30, inicio: somarDias(hoje, -3), fim: hoje });

    const doces = (res: request.Response) => (res.body.data as Linha[]).find((l) => l.cliente === 'Doces da Vovó')!;
    expect(longo.status).toBe(200);
    expect(doces(longo)).toMatchObject({ visitasNoPeriodo: 3, vendasNoPeriodo: 184 });
    expect(porDatas.status).toBe(200);
    expect(doces(porDatas)).toMatchObject({ visitasNoPeriodo: 1, vendasNoPeriodo: 84 }); // só a de −2 dias
    expect(dosDois.status).toBe(400);
  });

  it('gestor com ?representanteId= recebe só a carteira daquele representante', async () => {
    const res = await getRelatorio({ representanteId: representanteBId });

    expect(res.status).toBe(200);
    expect((res.body.data as Linha[]).map((linha) => linha.cliente)).toEqual(['Chocolates Gaspar']);
  });

  it('representante recebe só a própria carteira, mesmo mandando o representanteId de outro', async () => {
    const [semFiltro, comOutro] = await Promise.all([
      getRelatorio({}, tokenRepresentante),
      getRelatorio({ representanteId: representanteBId }, tokenRepresentante),
    ]);

    for (const res of [semFiltro, comOutro]) {
      expect(res.status).toBe(200);
      const linhas: Linha[] = res.body.data;
      expect(linhas).toHaveLength(6);
      expect(linhas.every((linha) => linha.representante === 'Eduarda Fischer')).toBe(true);
    }
    expect(comOutro.body.data).toEqual(semFiltro.body.data);
  });
});
