import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.kpis-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.kpis-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

type Resultado = 'VENDA' | 'SEM_VENDA' | 'NEGOCIACAO';

let token: string;
let tokenGestor: string;
let representanteId: string;
let clienteAId: string;
let clienteBId: string;
let clienteCId: string;
let clienteDId: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

/** Instante `diasAtras` dias antes de hoje, em horário de meio de dia (longe da virada do dia). */
function haDias(diasAtras: number): Date {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() - diasAtras);
  data.setUTCHours(15, 0, 0, 0);
  return data;
}

async function criarCliente(cnpj: string, nomeFantasia: string, ativo: boolean): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${nomeFantasia.toLowerCase().replace(/\s/g, '')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId: null,
      ativo,
    },
  });
  return cliente.id;
}

async function criarVisita(clientId: string, diasAtras: number, resultado: Resultado): Promise<void> {
  await prisma.visit.create({
    data: {
      clientId,
      userId: representanteId,
      dataHora: haDias(diasAtras),
      descricao: 'Visita de teste.',
      resultado,
    },
  });
}

async function criarClientes(): Promise<void> {
  clienteAId = await criarCliente('11222333000181', 'Emporio Pomerode', true);
  clienteBId = await criarCliente('11222333000262', 'Padaria Vale Europeu', true);
  clienteCId = await criarCliente('11222333000424', 'Emporio do Chocolate', true);
  clienteDId = await criarCliente('11222333000343', 'Armazem Sao Bento', false);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  await criarClientes();

  await criarVisita(clienteAId, 2, 'VENDA');
  await criarVisita(clienteAId, 10, 'SEM_VENDA');
  await criarVisita(clienteBId, 40, 'NEGOCIACAO');
  await criarVisita(clienteDId, 3, 'VENDA');
  await criarVisita(clienteAId, 100, 'VENDA');

  await prisma.stockMessage.create({
    data: {
      clientId: clienteCId,
      userId: representanteId,
      textoFinal: 'Mensagem de estoque de teste.',
      dataGeracao: haDias(5),
      eventoSazonalId: null,
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /dashboard/kpis', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/dashboard/kpis');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante recebe 200 com os indicadores da própria carteira', async () => {
    const res = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.clientesAtivos).toBe(3);
    expect(res.body.visitas.total).toBe(3);
  });

  it.each(['60', 'abc'])('periodoDias=%s responde 400 VALIDATION_ERROR', async (periodoDias) => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gestor recebe os indicadores dos últimos 30 dias', async () => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias: 30 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.periodo.dias).toBe(30);
    expect(res.body.clientesAtivos).toBe(3);
    // A (−2 e −10) e D (inativo, −3); B (−40) e A (−100) ficam fora do período.
    expect(res.body.visitas.total).toBe(3);
    expect(res.body.visitas.mediaPorCliente).toBe(1);
    // 2 vendas em 3 visitas.
    expect(res.body.conversaoEmVendas).toEqual({ numerador: 2, denominador: 3, percentual: 67 });
    // A por visita e C por mensagem; B (visita há 40 dias) fora; D inativo não entra.
    expect(res.body.taxaDeRegistro).toEqual({ numerador: 2, denominador: 3, percentual: 67 });

    // Sem ERP (erpId nulo): A VERDE (visita há 2 dias), B e C VERMELHO (visita há 40 dias e nenhuma).
    expect(res.body.inativos).toEqual({
      total: 2,
      distribuicao: { VERDE: 1, AMARELO: 0, LARANJA: 0, VERMELHO: 2 },
    });
    expect(res.body.semDados).toBe(false);
    expect(typeof res.body.simulado).toBe('boolean');
  });

  it('periodoDias ausente usa 30; 90 inclui a visita de 40 dias e 365 a de 100 dias', async () => {
    const padrao = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenGestor}`);
    const noventa = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias: 90 })
      .set('Authorization', `Bearer ${tokenGestor}`);
    const anual = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias: 365 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(padrao.status).toBe(200);
    expect(padrao.body.periodo.dias).toBe(30);
    expect(padrao.body.visitas.total).toBe(3);

    expect(noventa.status).toBe(200);
    expect(noventa.body.periodo.dias).toBe(90);
    expect(noventa.body.visitas.total).toBe(4);

    expect(anual.status).toBe(200);
    expect(anual.body.periodo.dias).toBe(365);
    expect(anual.body.visitas.total).toBe(5);
  });

  describe('período por datas', () => {
    const hojeEmSaoPaulo = (): string => dataCalendario(new Date());

    async function getKpis(query: Record<string, string | number>): Promise<request.Response> {
      return request(app).get('/dashboard/kpis').query(query).set('Authorization', `Bearer ${tokenGestor}`);
    }

    it('?inicio&fim responde periodo { dias: 25, inicio, fim } e conta a visita das 23:30 do último dia, não a das 00:10 do seguinte', async () => {
      const fim = somarDias(hojeEmSaoPaulo(), -5);
      const inicio = somarDias(fim, -24);
      const visita = (dataHora: string) =>
        prisma.visit.create({
          data: {
            clientId: clienteAId,
            userId: representanteId,
            dataHora: new Date(dataHora),
            descricao: 'Visita de teste.',
            resultado: 'VENDA',
          },
        });
      await visita(`${fim}T23:30:00.000-03:00`);
      await visita(`${somarDias(fim, 1)}T00:10:00.000-03:00`);

      const res = await getKpis({ inicio, fim });

      expect(res.status).toBe(200);
      expect(res.body.periodo).toEqual({ dias: 25, inicio, fim });
      // A visita de −10 dias do cenário base e a das 23:30 do último dia; a das 00:10 do dia seguinte, não.
      expect(res.body.visitas.total).toBe(2);
    });

    it('?periodoDias junto com ?inicio&fim responde 400 "Informe o período em dias ou por datas, não os dois."', async () => {
      const hoje = hojeEmSaoPaulo();

      const res = await getKpis({ periodoDias: 30, inicio: somarDias(hoje, -10), fim: hoje });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.map((d: { message: string }) => d.message)).toContain(
        'Informe o período em dias ou por datas, não os dois.',
      );
    });

    it('só uma das datas responde 400 "Informe o início e o fim do período."', async () => {
      const res = await getKpis({ inicio: somarDias(hojeEmSaoPaulo(), -10) });

      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { message: string }) => d.message)).toContain(
        'Informe o início e o fim do período.',
      );
    });

    it('fim antes do início responde 400 "A data de fim deve ser depois do início."', async () => {
      const hoje = hojeEmSaoPaulo();

      const res = await getKpis({ inicio: hoje, fim: somarDias(hoje, -1) });

      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { message: string }) => d.message)).toContain(
        'A data de fim deve ser depois do início.',
      );
    });

    it('fim depois de hoje responde 400 "A data de fim não pode ser depois de hoje."', async () => {
      const hoje = hojeEmSaoPaulo();

      const res = await getKpis({ inicio: hoje, fim: somarDias(hoje, 2) });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('A data de fim não pode ser depois de hoje.');
    });

    it('366 dias responde 400 com a mensagem do limite; 365 dias passa', async () => {
      const hoje = hojeEmSaoPaulo();

      const longo = await getKpis({ inicio: somarDias(hoje, -365), fim: hoje });
      const limite = await getKpis({ inicio: somarDias(hoje, -364), fim: hoje });

      expect(longo.status).toBe(400);
      expect(longo.body.error.message).toBe(
        'O período de visualização é de até 365 dias; para mais, use a Planilha.',
      );
      expect(limite.status).toBe(200);
      expect(limite.body.periodo.dias).toBe(365);
    });

    it('o comparativo por representante também aceita datas e respeita o limite', async () => {
      const hoje = hojeEmSaoPaulo();
      const comparativo = (query: Record<string, string>) =>
        request(app)
          .get('/dashboard/kpis/por-representante')
          .query(query)
          .set('Authorization', `Bearer ${tokenGestor}`);

      const ok = await comparativo({ inicio: somarDias(hoje, -11), fim: somarDias(hoje, -9) });
      const longo = await comparativo({ inicio: somarDias(hoje, -365), fim: hoje });

      expect(ok.status).toBe(200);
      expect(ok.body.periodo.dias).toBe(3);
      expect(ok.body.representantes[0].visitas).toBe(1); // a de −10 dias
      // O ritmo semanal não depende do período: segue até hoje mesmo com o período terminando há 9 dias.
      const visitasNoRitmo = (ok.body.ritmoSemanal as { visitas: number }[]).reduce((soma, s) => soma + s.visitas, 0);
      expect(visitasNoRitmo).toBe(4);
      expect(longo.status).toBe(400);
    });
  });

  it('semDados é true quando o período não tem visita nem mensagem', async () => {
    await truncateAllTables();
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
    representanteId = representante.id;
    await prisma.user.create({ data: { ...GESTOR, senhaHash } });
    tokenGestor = await logar(GESTOR.email);
    await criarClientes();

    const res = await request(app).get('/dashboard/kpis').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.semDados).toBe(true);
    expect(res.body.visitas.total).toBe(0);
    expect(res.body.conversaoEmVendas.percentual).toBeNull();
    expect(res.body.taxaDeRegistro).toEqual({ numerador: 0, denominador: 3, percentual: 0 });
  });
});

/**
 * Carteira de B: um cliente ativo com duas visitas no período — uma do
 * próprio B e uma do representante principal (autor de outra carteira,
 * que ainda assim conta para B: o filtro é a carteira do cliente) — e uma
 * mensagem de estoque.
 */
async function criarCarteiraB(): Promise<string> {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representanteB = await prisma.user.create({
    data: { nome: 'Bruno Alencar', email: 'bruno.kpis-teste@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
  });
  const clienteDeB = await prisma.client.create({
    data: {
      razaoSocial: 'Bombons Indaial Comércio Ltda',
      nomeFantasia: 'Bombons Indaial',
      cnpj: '11222333000505',
      cidade: 'Indaial',
      endereco: 'Rua Tiradentes, 10',
      telefone: '(47) 3333-0000',
      email: 'contato@bombonsindaial.com.br',
      recorrenciaDias: 15,
      representanteId: representanteB.id,
    },
  });
  await prisma.visit.createMany({
    data: [
      { clientId: clienteDeB.id, userId: representanteB.id, dataHora: haDias(4), descricao: 'Visita.', resultado: 'VENDA' },
      { clientId: clienteDeB.id, userId: representanteId, dataHora: haDias(6), descricao: 'Visita.', resultado: 'SEM_VENDA' },
    ],
  });
  await prisma.stockMessage.create({
    data: { clientId: clienteDeB.id, userId: representanteB.id, textoFinal: 'Mensagem de B.', dataGeracao: haDias(1) },
  });

  return representanteB.id;
}

describe('GET /dashboard/kpis com representanteId', () => {
  it('gestor com ?representanteId=<B> recebe os indicadores só da carteira de B', async () => {
    const representanteBId = await criarCarteiraB();

    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ representanteId: representanteBId })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.clientesAtivos).toBe(1);
    expect(res.body.visitas.total).toBe(2);
    expect(res.body.conversaoEmVendas).toEqual({ numerador: 1, denominador: 2, percentual: 50 });
    expect(res.body.taxaDeRegistro).toEqual({ numerador: 1, denominador: 1, percentual: 100 });
    expect(res.body.inativos.total).toBe(0);
    expect(res.body.semDados).toBe(false);
  });

  it('gestor com representanteId de usuário inexistente recebe zeros', async () => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ representanteId: randomUUID() })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.clientesAtivos).toBe(0);
    expect(res.body.visitas.total).toBe(0);
    expect(res.body.taxaDeRegistro.denominador).toBe(0);
    expect(res.body.inativos.total).toBe(0);
    expect(res.body.semDados).toBe(true);
  });

  it('gestor com representanteId de um usuário GESTOR recebe zeros', async () => {
    const gestor = await prisma.user.findUniqueOrThrow({ where: { email: GESTOR.email } });

    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ representanteId: gestor.id })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.clientesAtivos).toBe(0);
    expect(res.body.visitas.total).toBe(0);
    expect(res.body.taxaDeRegistro.denominador).toBe(0);
    expect(res.body.inativos.total).toBe(0);
    expect(res.body.semDados).toBe(true);
  });

  it('representante que manda o representanteId de outro recebe só a própria carteira', async () => {
    const representanteBId = await criarCarteiraB();

    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ representanteId: representanteBId })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // A, B e C (D é inativo); o cliente de B e as duas visitas a ele ficam de fora.
    expect(res.body.clientesAtivos).toBe(3);
    expect(res.body.visitas.total).toBe(3);
    expect(res.body.conversaoEmVendas).toEqual({ numerador: 2, denominador: 3, percentual: 67 });
    expect(res.body.taxaDeRegistro).toEqual({ numerador: 2, denominador: 3, percentual: 67 });
  });

  it('representanteId que não é uuid responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ representanteId: 'abc' })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /dashboard/kpis/por-representante', () => {
  type LinhaRepresentante = { id: string; nome: string; visitas: number };

  it('sem token responde 401', async () => {
    const res = await request(app).get('/dashboard/kpis/por-representante');

    expect(res.status).toBe(401);
  });

  it('representante recebe só a própria linha e o próprio ritmo, mesmo mandando o representanteId de outro', async () => {
    const representanteBId = await criarCarteiraB();

    const res = await request(app)
      .get('/dashboard/kpis/por-representante')
      .query({ representanteId: representanteBId })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.representantes).toEqual([
      expect.objectContaining({ id: representanteId, clientesAtivos: 3, visitas: 3, vendas: 2, semVenda: 1 }),
    ]);
    // Nas 8 semanas, só a carteira dela: −2, −3, −10 e −40 (a visita dela ao cliente de B conta para B).
    const visitasNoRitmo = res.body.ritmoSemanal.reduce(
      (soma: number, semana: { visitas: number }) => soma + semana.visitas,
      0,
    );
    expect(visitasNoRitmo).toBe(4);
  });

  it('periodoDias inválido responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/dashboard/kpis/por-representante')
      .query({ periodoDias: 60 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gestor recebe todos os representantes pela carteira, ordenados por visitas, com as contagens por resultado', async () => {
    const representanteBId = await criarCarteiraB();
    const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
    const semCarteira = await prisma.user.create({
      data: { nome: 'Carla Dias', email: 'carla.kpis-teste@chokolaten.com.br', role: 'REPRESENTANTE', senhaHash },
    });

    const res = await request(app)
      .get('/dashboard/kpis/por-representante')
      .query({ periodoDias: 30 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.periodo.dias).toBe(30);
    expect(typeof res.body.periodo.inicio).toBe('string');
    expect(res.body).not.toHaveProperty('porSemana');
    expect(typeof res.body.simulado).toBe('boolean');
    // Eduarda: A (−2 VENDA, −10 SEM_VENDA) e D inativo (−3 VENDA); a visita dela ao cliente de B conta para B.
    // O gestor não entra; Carla, sem carteira, aparece zerada.
    expect(res.body.representantes).toEqual([
      {
        id: representanteId,
        nome: REPRESENTANTE.nome,
        clientesAtivos: 3,
        visitas: 3,
        vendas: 2,
        negociacoes: 0,
        semVenda: 1,
        conversaoEmVendas: { numerador: 2, denominador: 3, percentual: 67 },
      },
      {
        id: representanteBId,
        nome: 'Bruno Alencar',
        clientesAtivos: 1,
        visitas: 2,
        vendas: 1,
        negociacoes: 0,
        semVenda: 1,
        conversaoEmVendas: { numerador: 1, denominador: 2, percentual: 50 },
      },
      {
        id: semCarteira.id,
        nome: 'Carla Dias',
        clientesAtivos: 0,
        visitas: 0,
        vendas: 0,
        negociacoes: 0,
        semVenda: 0,
        conversaoEmVendas: { numerador: 0, denominador: 0, percentual: null },
      },
    ]);
  });

  it('representante inativo continua no comparativo: inativar a conta não apaga o histórico do período', async () => {
    await prisma.user.update({ where: { id: representanteId }, data: { ativo: false } });

    const res = await request(app)
      .get('/dashboard/kpis/por-representante')
      .query({ periodoDias: 365 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.representantes).toEqual([expect.objectContaining({ id: representanteId, visitas: 5 })]);
  });

  it('periodoDias=365 inclui as visitas antigas da carteira', async () => {
    const res = await request(app)
      .get('/dashboard/kpis/por-representante')
      .query({ periodoDias: 365 })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.representantes.map((r: LinhaRepresentante) => r.visitas)).toEqual([5]);
    // −2, −3 e −100 VENDA; −10 SEM_VENDA; −40 NEGOCIACAO.
    expect(res.body.representantes[0]).toMatchObject({ vendas: 3, negociacoes: 1, semVenda: 1 });
  });

  describe('ritmoSemanal', () => {
    type Semana = { inicio: string; visitas: number; vendas: number };

    function somar(semanas: Semana[], campo: 'visitas' | 'vendas'): number {
      return semanas.reduce((soma, semana) => soma + semana[campo], 0);
    }

    it('tem 8 semanas de segunda a domingo, a última contendo hoje, e vendas conta só VENDA', async () => {
      const res = await request(app)
        .get('/dashboard/kpis/por-representante')
        .set('Authorization', `Bearer ${tokenGestor}`);

      expect(res.status).toBe(200);
      const semanas: Semana[] = res.body.ritmoSemanal;
      expect(semanas).toHaveLength(8);
      expect(semanas.every((semana) => new Date(`${semana.inicio}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
      semanas.slice(1).forEach((semana, indice) => expect(semana.inicio).toBe(somarDias(semanas[indice]!.inicio, 7)));

      const hoje = dataCalendario(new Date());
      const ultima = semanas[7]!;
      expect(ultima.inicio <= hoje && hoje <= somarDias(ultima.inicio, 6)).toBe(true);

      // Nas 8 semanas: −2 VENDA, −3 VENDA (cliente inativo, mesma carteira), −10 SEM_VENDA e −40 NEGOCIACAO;
      // −100 fica fora.
      expect(somar(semanas, 'visitas')).toBe(4);
      expect(somar(semanas, 'vendas')).toBe(2);
    });

    it('não depende do período escolhido', async () => {
      const [trinta, anual] = await Promise.all(
        [30, 365].map((periodoDias) =>
          request(app)
            .get('/dashboard/kpis/por-representante')
            .query({ periodoDias })
            .set('Authorization', `Bearer ${tokenGestor}`),
        ),
      );

      expect(trinta!.body.ritmoSemanal).toEqual(anual!.body.ritmoSemanal);
    });

    it('com representanteId cobre só a carteira dele', async () => {
      const representanteBId = await criarCarteiraB();

      const res = await request(app)
        .get('/dashboard/kpis/por-representante')
        .query({ representanteId: representanteBId })
        .set('Authorization', `Bearer ${tokenGestor}`);

      expect(res.status).toBe(200);
      expect(res.body.representantes.map((r: LinhaRepresentante) => r.id)).toEqual([representanteBId]);
      expect(res.body.representantes[0].visitas).toBe(2);
      expect(res.body).not.toHaveProperty('porSemana');

      const semanas: Semana[] = res.body.ritmoSemanal;
      expect(semanas).toHaveLength(8);
      // Carteira de B: −4 VENDA e −6 SEM_VENDA (esta feita pela Eduarda, mas o cliente é de B).
      expect(somar(semanas, 'visitas')).toBe(2);
      expect(somar(semanas, 'vendas')).toBe(1);
    });
  });
});
