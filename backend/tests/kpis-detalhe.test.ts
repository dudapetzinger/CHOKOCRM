import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

const SENHA_PADRAO = 'chokocrm123';
/** "Agora" fixo: 26/10/2026 ao meio-dia de São Paulo (15:00Z), longe da virada do dia. */
const AGORA = new Date('2026-10-26T15:00:00.000Z');
const MILISSEGUNDOS_POR_DIA = 86_400_000;

type Resultado = 'VENDA' | 'SEM_VENDA' | 'NEGOCIACAO';
type Consulta = Record<string, string | number>;

type VisitaDetalhe = {
  visitaId: string;
  clienteId: string;
  nomeFantasia: string;
  cidade: string;
  clienteAtivo: boolean;
  representanteId: string;
  representanteNome: string;
  dataHora: string;
  faixaInicio: string;
  resultado: Resultado;
  valor: number;
};

type NaoVisitado = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  representanteId: string;
  representanteNome: string;
  ultimaVisita: string | null;
  diasSemVisita: number | null;
};

let tokenGestor: string;
let tokenA: string;
let tokenB: string;
let repAId: string;
let repBId: string;
let clienteA1: string;
let clienteA2: string;
let clienteAInativo: string;
let clienteB1: string;

function haDias(diasAtras: number): Date {
  return new Date(AGORA.getTime() - diasAtras * MILISSEGUNDOS_POR_DIA);
}

async function logar(usuario: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_PADRAO });
  return login.body.token;
}

async function criarCliente(
  cnpj: string,
  nomeFantasia: string,
  cidade: string,
  representanteId: string,
  ativo = true,
): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade,
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${nomeFantasia.toLowerCase().replace(/\s/g, '')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
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
  itens: { quantidade: number; precoUnitario: string }[] = [],
): Promise<void> {
  await prisma.visit.create({
    data: {
      clientId,
      userId,
      dataHora: haDias(diasAtras),
      descricao: 'Visita de teste.',
      resultado,
      itens: {
        create: itens.map((item, indice) => ({
          sku: `SKU-${indice}`,
          produtoNome: `Produto ${indice}`,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
        })),
      },
    },
  });
}

beforeAll(() => {
  fixarRelogio(AGORA);
});

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({
    data: { nome: 'Ricardo Menezes', usuario: 'ricardo.detalhe-teste', role: 'GESTOR', senhaHash },
  });
  repAId = (
    await prisma.user.create({
      data: { nome: 'Eduarda Fischer', usuario: 'eduarda.detalhe-teste', role: 'REPRESENTANTE', senhaHash },
    })
  ).id;
  repBId = (
    await prisma.user.create({
      data: { nome: 'Bruno Alencar', usuario: 'bruno.detalhe-teste', role: 'REPRESENTANTE', senhaHash },
    })
  ).id;

  tokenGestor = await logar('ricardo.detalhe-teste');
  tokenA = await logar('eduarda.detalhe-teste');
  tokenB = await logar('bruno.detalhe-teste');

  clienteA1 = await criarCliente('11222333000181', 'Emporio Pomerode', 'Pomerode', repAId);
  clienteA2 = await criarCliente('11222333000262', 'Padaria Vale Europeu', 'Blumenau', repAId);
  await criarCliente('11222333000424', 'Emporio do Chocolate', 'Indaial', repAId);
  clienteAInativo = await criarCliente('11222333000343', 'Armazem Sao Bento', 'Timbo', repAId, false);
  clienteB1 = await criarCliente('11222333000505', 'Bombons Indaial', 'Indaial', repBId);

  await criarVisita(clienteA1, repAId, 2, 'VENDA', [
    { quantidade: 3, precoUnitario: '27.90' },
    { quantidade: 2, precoUnitario: '10.10' },
  ]);
  await criarVisita(clienteA1, repAId, 10, 'SEM_VENDA');
  await criarVisita(clienteA2, repAId, 20, 'NEGOCIACAO');
  await criarVisita(clienteAInativo, repAId, 3, 'VENDA', [{ quantidade: 1, precoUnitario: '50.00' }]);
  await criarVisita(clienteA1, repAId, 100, 'VENDA', [{ quantidade: 9, precoUnitario: '99.00' }]);
  await criarVisita(clienteB1, repBId, 4, 'VENDA', [{ quantidade: 4, precoUnitario: '12.50' }]);
  // Visita de A ao cliente de B: conta na carteira de B (o dono da carteira decide).
  await criarVisita(clienteB1, repAId, 6, 'SEM_VENDA');
});

afterAll(async () => {
  liberarRelogio();
  await truncateAllTables();
  await prisma.$disconnect();
});

function detalhe(token: string, query: Consulta = {}) {
  return request(app).get('/dashboard/kpis/visitas').query(query).set('Authorization', `Bearer ${token}`);
}

function kpis(token: string, query: Consulta = {}) {
  return request(app).get('/dashboard/kpis').query(query).set('Authorization', `Bearer ${token}`);
}

function porRepresentante(token: string, query: Consulta = {}) {
  return request(app).get('/dashboard/kpis/por-representante').query(query).set('Authorization', `Bearer ${token}`);
}

describe('GET /dashboard/kpis/visitas', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/dashboard/kpis/visitas');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it.each<Consulta>([{ periodoDias: 60 }, { periodoDias: 'abc' }, { representanteId: 'abc' }])(
    'parâmetros inválidos %p respondem 400 VALIDATION_ERROR, como a rota de indicadores',
    async (query) => {
      const res = await detalhe(tokenGestor, query);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('período por datas inválido responde 400 com a mesma mensagem da rota de indicadores', async () => {
    const esperado = await kpis(tokenGestor, { inicio: '2026-10-20' });
    const res = await detalhe(tokenGestor, { inicio: '2026-10-20' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(esperado.body.error.message);
  });

  it('entrega o período, a granularidade e a lista de visitas com todos os campos do contrato', async () => {
    const res = await detalhe(tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.periodo).toEqual((await kpis(tokenGestor)).body.periodo);
    expect(res.body.granularidade).toBe('SEMANA');
    expect(typeof res.body.simulado).toBe('boolean');

    const visitas: VisitaDetalhe[] = res.body.visitas;
    const venda = visitas.find((v) => v.clienteId === clienteA1 && v.resultado === 'VENDA')!;
    expect(venda).toEqual({
      visitaId: expect.any(String),
      clienteId: clienteA1,
      nomeFantasia: 'Emporio Pomerode',
      cidade: 'Pomerode',
      clienteAtivo: true,
      representanteId: repAId,
      representanteNome: 'Eduarda Fischer',
      dataHora: haDias(2).toISOString(),
      faixaInicio: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      resultado: 'VENDA',
      // 3 × 27,90 + 2 × 10,10
      valor: 103.9,
    });
  });

  it('o valor é zero fora das vendas, mesmo que a visita tenha itens', async () => {
    await criarVisita(clienteA2, repAId, 5, 'NEGOCIACAO', [{ quantidade: 2, precoUnitario: '30.00' }]);

    const res = await detalhe(tokenGestor);

    const naoVendas = (res.body.visitas as VisitaDetalhe[]).filter((v) => v.resultado !== 'VENDA');
    expect(naoVendas.length).toBeGreaterThan(0);
    expect(naoVendas.every((v) => v.valor === 0)).toBe(true);
  });

  it('as visitas vêm da mais recente para a mais antiga', async () => {
    const res = await detalhe(tokenGestor);

    const datas = (res.body.visitas as VisitaDetalhe[]).map((v) => v.dataHora);
    expect(datas).toEqual([...datas].sort((a, b) => b.localeCompare(a)));
  });

  it('o dono da carteira do cliente decide o representante da visita, não o autor', async () => {
    const res = await detalhe(tokenGestor);

    const visitaDeAaoClienteDeB = (res.body.visitas as VisitaDetalhe[]).find(
      (v) => v.clienteId === clienteB1 && v.resultado === 'SEM_VENDA',
    )!;
    expect(visitaDeAaoClienteDeB.representanteId).toBe(repBId);
    expect(visitaDeAaoClienteDeB.representanteNome).toBe('Bruno Alencar');
  });

  describe('concordância com os indicadores do painel', () => {
    it.each<Consulta>([{}, { inicio: '2026-10-20', fim: '2026-10-26' }, { periodoDias: 90 }, { periodoDias: 365 }, { inicio: '2026-10-01', fim: '2026-10-20' }])(
      'com %p: total, vendas, receita por representante e clientes visitados batem',
      async (query) => {
        const [resDetalhe, resKpis, resPorRep] = await Promise.all([
          detalhe(tokenGestor, query),
          kpis(tokenGestor, query),
          porRepresentante(tokenGestor, query),
        ]);
        const visitas: VisitaDetalhe[] = resDetalhe.body.visitas;

        expect(resDetalhe.body.periodo).toEqual(resKpis.body.periodo);
        expect(visitas.length).toBe(resKpis.body.visitas.total);
        expect(visitas.filter((v) => v.resultado === 'VENDA').length).toBe(
          resKpis.body.conversaoEmVendas.numerador,
        );

        const visitadosAtivos = new Set(visitas.filter((v) => v.clienteAtivo).map((v) => v.clienteId));
        expect(visitadosAtivos.size).toBe(resKpis.body.taxaDeRegistro.numerador);
        expect(visitadosAtivos.size + resDetalhe.body.naoVisitados.length).toBe(
          resKpis.body.taxaDeRegistro.denominador,
        );

        for (const representante of resPorRep.body.representantes) {
          const doRepresentante = visitas.filter((v) => v.representanteId === representante.id);
          const receita = doRepresentante
            .filter((v) => v.resultado === 'VENDA')
            .reduce((soma, v) => soma + v.valor, 0);

          expect(doRepresentante.length).toBe(representante.visitas);
          expect(doRepresentante.filter((v) => v.resultado === 'VENDA').length).toBe(representante.vendas);
          expect(doRepresentante.filter((v) => v.resultado === 'NEGOCIACAO').length).toBe(representante.negociacoes);
          expect(doRepresentante.filter((v) => v.resultado === 'SEM_VENDA').length).toBe(representante.semVenda);
          expect(Math.round(receita * 100) / 100).toBe(representante.receita);
        }
      },
    );

    it('a faixaInicio de cada visita é o início da faixa do ritmo que a contém', async () => {
      for (const query of [{}, { periodoDias: 365 }] as Consulta[]) {
        const [resDetalhe, resPorRep] = await Promise.all([
          detalhe(tokenGestor, query),
          porRepresentante(tokenGestor, query),
        ]);
        const { granularidade, faixas } = resPorRep.body.ritmo as {
          granularidade: string;
          faixas: { inicio: string; visitas: number }[];
        };
        const visitas: VisitaDetalhe[] = resDetalhe.body.visitas;

        expect(resDetalhe.body.granularidade).toBe(granularidade);
        for (const faixa of faixas) {
          expect(visitas.filter((v) => v.faixaInicio === faixa.inicio).length).toBe(faixa.visitas);
        }
        expect(visitas.every((v) => faixas.some((faixa) => faixa.inicio === v.faixaInicio))).toBe(true);
      }
    });

    it('em período longo a granularidade é MES e a faixaInicio é o primeiro dia do mês', async () => {
      const res = await detalhe(tokenGestor, { periodoDias: 365 });

      expect(res.body.granularidade).toBe('MES');
      expect((res.body.visitas as VisitaDetalhe[]).every((v) => v.faixaInicio.endsWith('-01'))).toBe(true);
    });
  });

  describe('clientes não visitados', () => {
    it('lista os clientes ativos sem visita no período, com o dono, a última visita e os dias sem visita', async () => {
      const res = await detalhe(tokenGestor);

      const naoVisitados: NaoVisitado[] = res.body.naoVisitados;
      // Em 30 dias: A1 (−2, −10), A2 (−20), B1 (−4, −6) foram visitados; resta "Emporio do Chocolate" (sem visita).
      expect(naoVisitados).toEqual([
        {
          id: expect.any(String),
          nomeFantasia: 'Emporio do Chocolate',
          cidade: 'Indaial',
          representanteId: repAId,
          representanteNome: 'Eduarda Fischer',
          ultimaVisita: null,
          diasSemVisita: null,
        },
      ]);
    });

    it('o cliente com visita só antes do período entra com a data da última visita e os dias contados até hoje', async () => {
      const res = await detalhe(tokenGestor, { inicio: '2026-10-20', fim: '2026-10-26' });

      const a2 = (res.body.naoVisitados as NaoVisitado[]).find((c) => c.id === clienteA2)!;
      expect(a2.ultimaVisita).toBe(haDias(20).toISOString());
      expect(a2.diasSemVisita).toBe(20);
    });

    it('não lista cliente inativo', async () => {
      const res = await detalhe(tokenGestor, { inicio: '2026-10-20', fim: '2026-10-26' });

      expect((res.body.naoVisitados as NaoVisitado[]).some((c) => c.id === clienteAInativo)).toBe(false);
    });

    it('a visita a cliente inativo entra na lista de visitas com clienteAtivo falso', async () => {
      const res = await detalhe(tokenGestor);

      const visita = (res.body.visitas as VisitaDetalhe[]).find((v) => v.clienteId === clienteAInativo)!;
      expect(visita.clienteAtivo).toBe(false);
      expect(visita.valor).toBe(50);
    });
  });

  describe('permissões e filtro de carteira', () => {
    it('o gestor com ?representanteId recebe só a carteira escolhida, visitas e não visitados', async () => {
      const res = await detalhe(tokenGestor, { representanteId: repBId });
      const esperado = await kpis(tokenGestor, { representanteId: repBId });

      expect(res.status).toBe(200);
      const visitas: VisitaDetalhe[] = res.body.visitas;
      expect(visitas.length).toBe(esperado.body.visitas.total);
      expect(visitas.every((v) => v.representanteId === repBId)).toBe(true);
      expect(res.body.naoVisitados).toEqual([]);
    });

    it('o representante que manda o representanteId de outro recebe só a própria carteira', async () => {
      const res = await detalhe(tokenA, { representanteId: repBId });
      const esperado = await kpis(tokenA);

      expect(res.status).toBe(200);
      const visitas: VisitaDetalhe[] = res.body.visitas;
      expect(visitas.length).toBe(esperado.body.visitas.total);
      expect(visitas.length).toBe(4);
      expect(visitas.every((v) => v.representanteId === repAId)).toBe(true);
      expect((res.body.naoVisitados as NaoVisitado[]).every((c) => c.representanteId === repAId)).toBe(true);
      expect(visitas.some((v) => v.clienteId === clienteB1)).toBe(false);
    });

    it('o representante vê apenas as visitas aos clientes da própria carteira', async () => {
      const res = await detalhe(tokenB);

      expect((res.body.visitas as VisitaDetalhe[]).map((v) => v.clienteId)).toEqual([clienteB1, clienteB1]);
    });

    it('representanteId de usuário inexistente recebe listas vazias', async () => {
      const res = await detalhe(tokenGestor, { representanteId: randomUUID() });

      expect(res.status).toBe(200);
      expect(res.body.visitas).toEqual([]);
      expect(res.body.naoVisitados).toEqual([]);
    });
  });
});
