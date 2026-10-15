import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ErpIndisponivelError } from '../src/providers/erp/ErpProvider';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

type PontoMensal = { mes: string; total: number; clientesComDados: number };

let tokenRepresentante: string;
let tokenGestor: string;
let representanteAId: string;
let representanteBId: string;
let representanteSemErpId: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarUsuario(
  nome: string,
  email: string,
  role: 'REPRESENTANTE' | 'GESTOR',
  senhaHash: string,
): Promise<string> {
  const usuario = await prisma.user.create({ data: { nome, email, role, senhaHash } });
  return usuario.id;
}

async function criarCliente(
  cnpj: string,
  representanteId: string,
  erpId: string | null,
  ativo = true,
): Promise<void> {
  await prisma.client.create({
    data: {
      razaoSocial: `Cliente ${cnpj} Ltda`,
      nomeFantasia: `Cliente ${cnpj}`,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato${cnpj}@cliente.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId,
      ativo,
    },
  });
}

function getVendasMensais(query: Record<string, string> = {}, token = tokenGestor): request.Test {
  return request(app).get('/dashboard/vendas-mensais').query(query).set('Authorization', `Bearer ${token}`);
}

/** Mês atual ('AAAA-MM') em America/Sao_Paulo. */
function mesAtual(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  representanteAId = await criarUsuario('Eduarda Fischer', 'eduarda.vendas@chokolaten.com.br', 'REPRESENTANTE', senhaHash);
  representanteBId = await criarUsuario('Bruno Alencar', 'bruno.vendas@chokolaten.com.br', 'REPRESENTANTE', senhaHash);
  representanteSemErpId = await criarUsuario('Carla Dias', 'carla.vendas@chokolaten.com.br', 'REPRESENTANTE', senhaHash);
  await criarUsuario('Ricardo Menezes', 'ricardo.vendas@chokolaten.com.br', 'GESTOR', senhaHash);

  // Carteira A: dois ativos com erpId e um inativo (fora da consulta); B: um ativo; Carla: só cliente sem erpId.
  await criarCliente('11222333000181', representanteAId, 'ERP-1001');
  await criarCliente('11222333000262', representanteAId, 'ERP-1002');
  await criarCliente('11222333000343', representanteAId, 'ERP-1004', false);
  await criarCliente('11222333000424', representanteBId, 'ERP-1003');
  await criarCliente('11222333000505', representanteSemErpId, null);

  tokenRepresentante = await logar('eduarda.vendas@chokolaten.com.br');
  tokenGestor = await logar('ricardo.vendas@chokolaten.com.br');
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /dashboard/vendas-mensais', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/dashboard/vendas-mensais');

    expect(res.status).toBe(401);
  });

  it('representante responde 403', async () => {
    const res = await getVendasMensais({}, tokenRepresentante);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('representanteId que não é uuid responde 400 VALIDATION_ERROR', async () => {
    const res = await getVendasMensais({ representanteId: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gestor recebe 12 meses até o atual, eventos e o ERP simulado', async () => {
    const res = await getVendasMensais();

    expect(res.status).toBe(200);
    expect(res.body.simulado).toBe(true);
    // Só os ativos com erpId: ERP-1001, ERP-1002 e ERP-1003 (o inativo e o sem erpId ficam fora).
    expect(res.body.clientesConsultados).toBe(3);
    expect(res.body.clientesIndisponiveis).toBe(0);

    const meses: PontoMensal[] = res.body.meses;
    expect(meses).toHaveLength(12);
    expect(meses[11]!.mes).toBe(mesAtual());
    expect(meses.some((ponto) => ponto.total > 0)).toBe(true);
    expect(meses.every((ponto) => ponto.clientesComDados >= 0 && ponto.clientesComDados <= 3)).toBe(true);

    expect(res.body.eventos.length).toBeGreaterThan(0);
    for (const evento of res.body.eventos) {
      expect(evento).toEqual({ chave: expect.any(String), nome: expect.any(String), data: expect.any(String) });
      expect(evento.data.slice(0, 7) >= meses[0]!.mes).toBe(true);
    }
  });

  it('?representanteId= filtra: A + B somam a empresa, mês a mês', async () => {
    const [todos, deA, deB] = await Promise.all([
      getVendasMensais(),
      getVendasMensais({ representanteId: representanteAId }),
      getVendasMensais({ representanteId: representanteBId }),
    ]);

    expect(deA.status).toBe(200);
    expect(deB.status).toBe(200);
    expect(deA.body.clientesConsultados).toBe(2);
    expect(deB.body.clientesConsultados).toBe(1);
    expect(deB.body.meses.every((ponto: PontoMensal) => ponto.clientesComDados <= 1)).toBe(true);

    todos.body.meses.forEach((ponto: PontoMensal, i: number) => {
      expect(deA.body.meses[i].mes).toBe(ponto.mes);
      expect(deA.body.meses[i].total + deB.body.meses[i].total).toBeCloseTo(ponto.total, 2);
      expect(deA.body.meses[i].clientesComDados + deB.body.meses[i].clientesComDados).toBe(ponto.clientesComDados);
    });
  });

  it('carteira sem erpId: 12 meses zerados e nenhum cliente consultado', async () => {
    const getSales = jest.spyOn(erpProvider, 'getSales');

    const res = await getVendasMensais({ representanteId: representanteSemErpId });

    expect(res.status).toBe(200);
    expect(res.body.meses).toHaveLength(12);
    expect(res.body.meses.every((ponto: PontoMensal) => ponto.total === 0 && ponto.clientesComDados === 0)).toBe(true);
    expect(res.body.clientesConsultados).toBe(0);
    expect(res.body.clientesIndisponiveis).toBe(0);
    expect(res.body.eventos.length).toBeGreaterThan(0);
    expect(getSales).not.toHaveBeenCalled();
  });

  it('provider indisponível responde 200 com todos os consultados indisponíveis e meses zerados', async () => {
    jest.spyOn(erpProvider, 'getSales').mockRejectedValue(new ErpIndisponivelError());

    const res = await getVendasMensais();

    expect(res.status).toBe(200);
    expect(res.body.clientesConsultados).toBe(3);
    expect(res.body.clientesIndisponiveis).toBe(res.body.clientesConsultados);
    expect(res.body.meses).toHaveLength(12);
    expect(res.body.meses.every((ponto: PontoMensal) => ponto.total === 0 && ponto.clientesComDados === 0)).toBe(true);
  });

  it('consulta o ERP do primeiro dia do mês mais antigo ao fim de hoje', async () => {
    const getSales = jest.spyOn(erpProvider, 'getSales');

    const res = await getVendasMensais({ representanteId: representanteBId });

    expect(res.status).toBe(200);
    expect(getSales).toHaveBeenCalledTimes(1);
    const [erpId, periodo] = getSales.mock.calls[0]!;
    expect(erpId).toBe('ERP-1003');
    expect(periodo.inicio).toEqual(new Date(`${res.body.meses[0].mes}-01T00:00:00.000-03:00`));
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    expect(periodo.fim).toEqual(new Date(`${hoje}T23:59:59.999-03:00`));
  });
});
