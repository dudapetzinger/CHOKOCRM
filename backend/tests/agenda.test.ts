import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import type { ResultadoVisita } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ErpIndisponivelError } from '../src/providers/erp/ErpProvider';
import { perfilDoErpId } from '../src/providers/erp/mock/gerador';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

/** Procura, entre ERP-1001 e ERP-1300, um erpId cujo perfil tenha `mesesSemCompra >= minMeses`. */
function encontrarErpIdComMesesSemCompra(minMeses: number): string {
  for (let i = 1001; i <= 1300; i++) {
    const erpId = `ERP-${i}`;
    if (perfilDoErpId(erpId).mesesSemCompra >= minMeses) {
      return erpId;
    }
  }

  throw new Error(`Nenhum erpId em ERP-1001..ERP-1300 com mesesSemCompra >= ${minMeses}.`);
}

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE_A = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.agenda-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_B = {
  nome: 'Bruno Alencar',
  email: 'bruno.agenda-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_C = {
  nome: 'Carla Nunes',
  email: 'carla.agenda-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.agenda-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let tokenA: string;
let tokenC: string;
let tokenGestor: string;
let representanteAId: string;
let representanteBId: string;
let clienteAtrasadoId: string;
let clienteHojeId: string;
let clienteFuturoId: string;
let clienteBId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function criarCliente(
  cnpj: string,
  nomeFantasia: string,
  representanteId: string,
  opts: { ativo?: boolean; recorrenciaDias?: number; erpId?: string } = {},
): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${apelido(nomeFantasia)}.com.br`,
      ativo: opts.ativo ?? true,
      recorrenciaDias: opts.recorrenciaDias ?? 15,
      representanteId,
      erpId: opts.erpId,
    },
  });
  return cliente.id;
}

async function criarVisita(
  clienteId: string,
  userId: string,
  diasAtras: number,
  resultado: ResultadoVisita = 'VENDA',
): Promise<void> {
  await prisma.visit.create({
    data: {
      clientId: clienteId,
      userId,
      dataHora: new Date(Date.now() - diasAtras * 86_400_000),
      descricao: 'Visita de teste.',
      resultado,
    },
  });
}

/** Lembrete gravado direto no banco (`@db.Date` = meia-noite UTC), `dias` a partir de hoje (negativo = vencido). */
async function criarLembrete(
  clienteId: string,
  criadoPorId: string,
  texto: string,
  dias: number,
  concluidoEm?: Date,
): Promise<string> {
  const dia = somarDias(dataCalendario(new Date()), dias);
  const lembrete = await prisma.reminder.create({
    data: { clientId: clienteId, criadoPorId, texto, data: new Date(`${dia}T00:00:00.000Z`), concluidoEm },
  });
  return lembrete.id;
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representanteA = await prisma.user.create({ data: { ...REPRESENTANTE_A, senhaHash } });
  const representanteB = await prisma.user.create({ data: { ...REPRESENTANTE_B, senhaHash } });
  await prisma.user.create({ data: { ...REPRESENTANTE_C, senhaHash } });
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });
  representanteAId = representanteA.id;
  representanteBId = representanteB.id;

  tokenA = await logar(REPRESENTANTE_A.email);
  tokenC = await logar(REPRESENTANTE_C.email);
  tokenGestor = await logar(GESTOR.email);

  clienteAtrasadoId = await criarCliente('11222333000181', 'Emporio Pomerode', representanteAId);
  clienteHojeId = await criarCliente('11222333000262', 'Cafe Blumenau', representanteAId);
  clienteFuturoId = await criarCliente('11222333000343', 'Doceria Jaragua', representanteAId);
  const clienteInativoId = await criarCliente('11222333000424', 'Chocolates Timbo', representanteAId, {
    ativo: false,
  });
  clienteBId = await criarCliente('11222333000505', 'Bombons Indaial', representanteBId);

  await criarVisita(clienteAtrasadoId, representanteAId, 20);
  await criarVisita(clienteHojeId, representanteAId, 15);
  await criarVisita(clienteFuturoId, representanteAId, 3);
  await criarVisita(clienteInativoId, representanteAId, 40);
  await criarVisita(clienteBId, representanteBId, 40);
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /agenda/today', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/agenda/today');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante vê só a própria carteira, sem inativos e sem visitas futuras', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.atrasadas.map((item: { id: string }) => item.id)).toEqual([clienteAtrasadoId]);
    expect(res.body.data.hoje.map((item: { id: string }) => item.id)).toEqual([clienteHojeId]);
  });

  it('gestor vê a agenda de todos os representantes', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    const idsAtrasadas = res.body.data.atrasadas.map((item: { id: string }) => item.id);
    expect(idsAtrasadas).toHaveLength(2);
    expect(idsAtrasadas).toEqual(expect.arrayContaining([clienteAtrasadoId, clienteBId]));
  });

  it('representante sem clientes recebe listas vazias', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenC}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ atrasadas: [], hoje: [], proximos7Dias: [], lembretes: [] });
  });

  it('traz os próximos 7 dias com a data marcada no check-in e o endereço (spec 7.4)', async () => {
    // Visitado há 3 dias com recorrência de 15: pela recorrência, só daqui a 12 dias
    const daquiADoisDias = somarDias(dataCalendario(new Date()), 2);
    await prisma.client.update({
      where: { id: clienteFuturoId },
      data: { proximaVisita: new Date(`${daquiADoisDias}T00:00:00.000Z`) },
    });

    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.proximos7Dias).toEqual([
      expect.objectContaining({
        id: clienteFuturoId,
        proximaVisita: daquiADoisDias,
        diasAtraso: -2,
        marcadaNoCheckIn: true,
        endereco: 'Rua Hermann Weege, 100',
      }),
    ]);
    const [atrasado] = res.body.data.atrasadas;
    expect(atrasado).toMatchObject({ endereco: 'Rua Hermann Weege, 100', marcadaNoCheckIn: false });
  });

  it('item traz cor, diasSemVisita, proximaVisita YYYY-MM-DD e diasAtraso', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const [item] = res.body.data.atrasadas;
    expect(item).toMatchObject({
      id: clienteAtrasadoId,
      nomeFantasia: 'Emporio Pomerode',
      cidade: 'Pomerode',
      cor: 'LARANJA',
      diasSemVisita: 20,
      diasAtraso: 5,
    });
    expect(item.proximaVisita).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cliente rebaixado ordena como LARANJA e traz rebaixadoPorVenda true', async () => {
    const erpId = encontrarErpIdComMesesSemCompra(3);
    await prisma.client.update({ where: { id: clienteHojeId }, data: { erpId } });

    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const item = res.body.data.hoje.find((i: { id: string }) => i.id === clienteHojeId);
    expect(item).toBeDefined();
    expect(item.cor).toBe('LARANJA');
    expect(item.rebaixadoPorVenda).toBe(true);
  });

  it('traz os lembretes abertos até hoje da carteira; os de amanhã, os concluídos e os de outro representante não', async () => {
    const vencido = await criarLembrete(clienteAtrasadoId, representanteAId, 'Levar amostras de Natal', -3);
    const deHoje = await criarLembrete(clienteHojeId, representanteAId, 'Confirmar pedido', 0);
    await criarLembrete(clienteFuturoId, representanteAId, 'Só amanhã', 1);
    await criarLembrete(clienteAtrasadoId, representanteAId, 'Já feito', -1, new Date());
    await criarLembrete(clienteBId, representanteBId, 'Da carteira do Bruno', 0);

    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.lembretes).toEqual([
      {
        id: vencido,
        clienteId: clienteAtrasadoId,
        nomeFantasia: 'Emporio Pomerode',
        cidade: 'Pomerode',
        texto: 'Levar amostras de Natal',
        data: somarDias(dataCalendario(new Date()), -3),
        diasAtraso: 3,
        representante: { id: representanteAId, nome: REPRESENTANTE_A.nome },
      },
      expect.objectContaining({ id: deHoje, texto: 'Confirmar pedido', diasAtraso: 0 }),
    ]);
  });

  it('gestor vê os lembretes de todas as carteiras', async () => {
    await criarLembrete(clienteHojeId, representanteAId, 'Da Eduarda', 0);
    await criarLembrete(clienteBId, representanteBId, 'Do Bruno', 0);

    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.body.data.lembretes.map((lembrete: { texto: string }) => lembrete.texto).sort()).toEqual([
      'Da Eduarda',
      'Do Bruno',
    ]);
  });

  it('provider indisponível responde 200', async () => {
    jest.spyOn(erpProvider, 'getLastSale').mockRejectedValue(new ErpIndisponivelError());
    await prisma.client.update({ where: { id: clienteHojeId }, data: { erpId: 'ERP-1001' } });

    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const item = res.body.data.hoje.find((i: { id: string }) => i.id === clienteHojeId);
    expect(item).toBeDefined();
    expect(item.cor).toBe('VERDE');
    expect(item.rebaixadoPorVenda).toBe(false);
  });
});

describe('GET /agenda/today com representanteId', () => {
  it('gestor com ?representanteId=<B> vê só a carteira de B', async () => {
    const res = await request(app)
      .get('/agenda/today')
      .query({ representanteId: representanteBId })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data.atrasadas.map((item: { id: string }) => item.id)).toEqual([clienteBId]);
    expect(res.body.data.hoje).toEqual([]);
  });

  it('gestor com representanteId de usuário inexistente recebe listas vazias', async () => {
    const res = await request(app)
      .get('/agenda/today')
      .query({ representanteId: randomUUID() })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ atrasadas: [], hoje: [], proximos7Dias: [], lembretes: [] });
  });

  it('representante A com ?representanteId=<B> continua vendo a própria carteira', async () => {
    const res = await request(app)
      .get('/agenda/today')
      .query({ representanteId: representanteBId })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.atrasadas.map((item: { id: string }) => item.id)).toEqual([clienteAtrasadoId]);
    expect(res.body.data.hoje.map((item: { id: string }) => item.id)).toEqual([clienteHojeId]);
  });

  it('item traz o representante dono da carteira, para o gestor e para o representante', async () => {
    const resGestor = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenGestor}`);
    const resA = await request(app).get('/agenda/today').set('Authorization', `Bearer ${tokenA}`);

    const itemB = resGestor.body.data.atrasadas.find((item: { id: string }) => item.id === clienteBId);
    expect(itemB.representante).toEqual({ id: representanteBId, nome: REPRESENTANTE_B.nome });
    const [itemA] = resA.body.data.hoje;
    expect(itemA.representante).toEqual({ id: representanteAId, nome: REPRESENTANTE_A.nome });
  });

  it('representanteId que não é uuid responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/agenda/today')
      .query({ representanteId: 'abc' })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /agenda/calendario', () => {
  const hojeCal = (): string => dataCalendario(new Date());
  const mesAtual = (): string => hojeCal().slice(0, 7);

  type Item = { data: string; tipo: string; clienteId?: string; titulo: string };

  function visitas(res: request.Response): Item[] {
    return res.body.data.itens.filter((item: Item) => item.tipo === 'VISITA');
  }

  async function criarCampanhaDeHoje(): Promise<void> {
    const dia = new Date(`${hojeCal()}T00:00:00.000Z`);
    await prisma.campaign.create({
      data: { nome: 'Campanha do mês', tipo: 'CAMPANHA', inicio: dia, fim: dia, produtos: [] },
    });
  }

  it('sem token responde 401', async () => {
    const res = await request(app).get('/agenda/calendario').query({ mes: mesAtual() });

    expect(res.status).toBe(401);
  });

  /** Marca a próxima visita (coluna `@db.Date`) do cliente para `dias` a partir de hoje. */
  async function marcarVisita(clienteId: string, dias: number): Promise<string> {
    const dia = somarDias(hojeCal(), dias);
    await prisma.client.update({ where: { id: clienteId }, data: { proximaVisita: new Date(`${dia}T00:00:00.000Z`) } });
    return dia;
  }

  it('representante vê só as visitas marcadas da própria carteira; sem data marcada, fica de fora', async () => {
    await marcarVisita(clienteHojeId, 0);
    await marcarVisita(clienteBId, 0);

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual() })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mes).toBe(mesAtual());
    // clienteAtrasado (recorrência vencida) e clienteFuturo não têm data marcada
    expect(visitas(res)).toEqual([expect.objectContaining({ data: hojeCal(), clienteId: clienteHojeId })]);
    expect(res.body.data.itens.some((item: Item & { origem?: string }) => 'origem' in item)).toBe(false);
  });

  it('visita marcada que já passou fica no dia marcado, com o detalhe do vencimento', async () => {
    const dia = await marcarVisita(clienteAtrasadoId, -1);

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: dia.slice(0, 7) })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(visitas(res)).toEqual([
      expect.objectContaining({ data: dia, clienteId: clienteAtrasadoId, detalhe: 'Visita marcada venceu há 1 dia' }),
    ]);
  });

  it('traz os lembretes abertos no dia deles; concluídos e de outra carteira ficam de fora', async () => {
    const dia = somarDias(hojeCal(), 0);
    const aberto = await criarLembrete(clienteHojeId, representanteAId, 'Levar amostras de Natal', 0);
    await criarLembrete(clienteAtrasadoId, representanteAId, 'Já feito', 0, new Date());
    await criarLembrete(clienteBId, representanteBId, 'Do Bruno', 0);

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: dia.slice(0, 7) })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.itens).toEqual([
      {
        data: dia,
        tipo: 'LEMBRETE',
        titulo: 'Cafe Blumenau',
        clienteId: clienteHojeId,
        lembreteId: aberto,
        texto: 'Levar amostras de Natal',
        representante: { id: representanteAId, nome: REPRESENTANTE_A.nome },
      },
    ]);
  });

  it('lembrete de outro mês não aparece no mês pedido', async () => {
    await criarLembrete(clienteHojeId, representanteAId, 'Daqui a dois meses', 62);

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual() })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.body.data.itens).toEqual([]);
  });

  it('representante com representanteId de outro recebe a própria carteira', async () => {
    await marcarVisita(clienteHojeId, 0);
    await marcarVisita(clienteBId, 0);

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual(), representanteId: representanteBId })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(visitas(res).map((item) => item.clienteId)).toEqual([clienteHojeId]);
  });

  it('gestor com representanteId vê só a carteira daquele representante', async () => {
    await marcarVisita(clienteHojeId, 0);
    await marcarVisita(clienteBId, 0);
    await criarLembrete(clienteHojeId, representanteAId, 'Da Eduarda', 0);
    await criarLembrete(clienteBId, representanteBId, 'Do Bruno', 0);

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual(), representanteId: representanteBId })
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data.itens.map((item: Item) => [item.tipo, item.clienteId])).toEqual([
      ['VISITA', clienteBId],
      ['LEMBRETE', clienteBId],
    ]);
  });

  it('campanhas aparecem para o gestor e não para o representante', async () => {
    await criarCampanhaDeHoje();

    const resGestor = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual() })
      .set('Authorization', `Bearer ${tokenGestor}`);
    const resA = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual() })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(resGestor.body.data.itens).toContainEqual(
      expect.objectContaining({ data: hojeCal(), tipo: 'CAMPANHA', titulo: 'Campanha do mês' }),
    );
    expect(resA.status).toBe(200);
    expect(resA.body.data.itens.filter((item: Item) => item.tipo === 'CAMPANHA')).toEqual([]);
  });

  it('traz as datas sazonais do mês no dia do evento', async () => {
    const dia = new Date(`${hojeCal()}T00:00:00.000Z`);
    await prisma.seasonalEvent.create({
      data: { nome: 'Dia de teste', chave: 'NATAL', dataInicio: dia, dataFim: dia, produtosSugeridos: [] },
    });

    const res = await request(app)
      .get('/agenda/calendario')
      .query({ mes: mesAtual() })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.body.data.itens).toContainEqual({
      data: hojeCal(),
      tipo: 'DATA_SAZONAL',
      titulo: 'Dia de teste',
      detalhe: 'Data sazonal',
    });
  });

  it.each(['2026-13', '2026-1', 'outubro', undefined])('mes=%s responde 400 com a mensagem do formato', async (mes) => {
    const res = await request(app)
      .get('/agenda/calendario')
      .query(mes === undefined ? {} : { mes })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ path: 'mes', message: 'Mês deve estar no formato AAAA-MM.' }]);
  });
});
