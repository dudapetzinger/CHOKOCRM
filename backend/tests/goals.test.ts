import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const GESTOR = { nome: 'Maicon Krüger', email: 'maicon.goals-teste@chokolaten.com.br', role: 'GESTOR' as const };
const EDUARDA = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.goals-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};
const RAFAEL = {
  nome: 'Rafael Schmitt',
  email: 'rafael.goals-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};
const ANA_INATIVA = {
  nome: 'Ana Souza',
  email: 'ana.goals-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
  ativo: false,
};

let tokenGestor: string;
let tokenEduarda: string;
let gestorId: string;
let eduardaId: string;
let rafaelId: string;
let anaId: string;
let clienteDaEduardaId: string;
let clienteDoRafaelId: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

function autenticado(req: request.Test, token: string): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

let proximoCnpj = 0;

async function criarCliente(representanteId: string, nomeFantasia: string): Promise<string> {
  proximoCnpj += 1;
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj: String(22333444000100 + proximoCnpj),
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: 'contato@cliente-goals-teste.com.br',
      representanteId,
    },
  });
  return cliente.id;
}

/** Campanha gravada direto no banco (`@db.Date` = meia-noite UTC). */
async function criarCampanha(inicio: string, fim: string, nome = 'Natal Chokolaten'): Promise<string> {
  const campanha = await prisma.campaign.create({
    data: {
      nome,
      tipo: 'CAMPANHA',
      inicio: new Date(`${inicio}T00:00:00.000Z`),
      fim: new Date(`${fim}T00:00:00.000Z`),
      produtos: [],
    },
  });
  return campanha.id;
}

/** Visita gravada direto no banco, num instante dado (ISO com fuso). */
async function criarVisita(params: {
  clientId: string;
  userId: string;
  dataHora: string;
  resultado?: 'VENDA' | 'NEGOCIACAO' | 'SEM_VENDA';
  campanhaId?: string | null;
  itens?: { quantidade: number; precoUnitario: number }[];
}): Promise<void> {
  const { itens = [], dataHora, resultado = 'VENDA', ...dados } = params;
  await prisma.visit.create({
    data: {
      ...dados,
      resultado,
      dataHora: new Date(dataHora),
      descricao: 'Visita de teste das metas.',
      ...(itens.length > 0
        ? {
            itens: {
              create: itens.map((item) => ({ ...item, sku: 'BOMB-SORT', produtoNome: 'Bombons sortidos' })),
            },
          }
        : {}),
    },
  });
}

function corpoDaMeta(overrides: Record<string, unknown> = {}) {
  return {
    representanteId: eduardaId,
    periodo: 'PERSONALIZADO',
    inicio: '2026-10-05',
    fim: '2026-10-20',
    metaVisitas: 12,
    metaVendas: 6000,
    ...overrides,
  };
}

async function criarMeta(overrides: Record<string, unknown> = {}): Promise<request.Response> {
  return autenticado(request(app).post('/goals'), tokenGestor).send(corpoDaMeta(overrides));
}

function mensagensDoErro(res: request.Response): string[] {
  return (res.body.error.details ?? []).map((detalhe: { message: string }) => detalhe.message);
}

/** O id da única meta gravada (o POST acabou de criá-la). */
async function idDaUnicaMeta(): Promise<string> {
  return (await prisma.goal.findFirstOrThrow()).id;
}

/** O DTO da meta de `corpoDaMeta()` recém-criada, sem realizado; `overrides` muda o que o caso muda. */
function dtoDaMeta(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    representante: { id: eduardaId, nome: EDUARDA.nome },
    periodo: 'PERSONALIZADO',
    inicio: '2026-10-05',
    fim: '2026-10-20',
    metaVisitas: 12,
    metaVendas: 6000,
    campanhaId: null,
    realizado: { visitas: 0, vendas: 0, clientes: [] },
    ...overrides,
  };
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  gestorId = (await prisma.user.create({ data: { ...GESTOR, senhaHash } })).id;
  eduardaId = (await prisma.user.create({ data: { ...EDUARDA, senhaHash } })).id;
  rafaelId = (await prisma.user.create({ data: { ...RAFAEL, senhaHash } })).id;
  anaId = (await prisma.user.create({ data: { ...ANA_INATIVA, senhaHash } })).id;

  tokenGestor = await logar(GESTOR.email);
  tokenEduarda = await logar(EDUARDA.email);

  clienteDaEduardaId = await criarCliente(eduardaId, 'Emporio Pomerode');
  clienteDoRafaelId = await criarCliente(rafaelId, 'Cafe Blumenau');
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('POST /goals', () => {
  it('responde 401 sem token', async () => {
    const res = await request(app).post('/goals').send(corpoDaMeta());

    expect(res.status).toBe(401);
  });

  it('o gestor cria uma meta de período personalizado (201) e recebe o DTO com o realizado', async () => {
    const res = await criarMeta();

    expect(res.status).toBe(201);
    const gravada = await prisma.goal.findFirstOrThrow();
    expect(res.body).toEqual(dtoDaMeta(gravada.id));
    // `@db.Date` sem deslocar um dia
    expect(gravada.inicio.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(gravada.fim.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(gravada.metaVendas.toString()).toBe('6000');
  });

  it('mensal: o período vira o mês inteiro da data de início', async () => {
    const res = await criarMeta({ periodo: 'MENSAL', inicio: '2026-10-15', fim: '2026-10-15' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(dtoDaMeta(await idDaUnicaMeta(), { periodo: 'MENSAL', inicio: '2026-10-01', fim: '2026-10-31' }));
  });

  it('semanal: o período vira a semana (segunda a domingo) da data de início', async () => {
    const res = await criarMeta({ periodo: 'SEMANAL', inicio: '2026-10-15', fim: '2026-10-15' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      dtoDaMeta(await idDaUnicaMeta(), { periodo: 'SEMANAL', inicio: '2026-10-12', fim: '2026-10-18' }),
    );
  });

  it('aceita metas zero e vendas com centavos (arredondadas a 2 casas)', async () => {
    const res = await criarMeta({ metaVisitas: 0, metaVendas: 1234.567 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(dtoDaMeta(await idDaUnicaMeta(), { metaVisitas: 0, metaVendas: 1234.57 }));
  });

  it('o representante não cria (403) e nada é gravado', async () => {
    const res = await autenticado(request(app).post('/goals'), tokenEduarda).send(corpoDaMeta());

    expect(res.status).toBe(403);
    expect(await prisma.goal.count()).toBe(0);
  });

  it('fim antes do início → 400 com a mensagem', async () => {
    const res = await criarMeta({ inicio: '2026-10-20', fim: '2026-10-19' });

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain('A data de fim deve ser depois do início.');
  });

  it('fim no mesmo dia do início é aceito', async () => {
    const res = await criarMeta({ inicio: '2026-10-20', fim: '2026-10-20' });

    expect(res.status).toBe(201);
  });

  it.each([
    ['metaVisitas negativa', { metaVisitas: -1 }, 'A meta de visitas deve ser um número inteiro maior ou igual a 0.'],
    [
      'metaVisitas fracionária',
      { metaVisitas: 1.5 },
      'A meta de visitas deve ser um número inteiro maior ou igual a 0.',
    ],
    ['metaVisitas em texto', { metaVisitas: '12' }, 'A meta de visitas deve ser um número inteiro maior ou igual a 0.'],
    ['metaVendas negativa', { metaVendas: -0.01 }, 'A meta de vendas deve ser um valor maior ou igual a 0.'],
    ['metaVendas em texto', { metaVendas: '6000' }, 'A meta de vendas deve ser um valor maior ou igual a 0.'],
    ['periodo desconhecido', { periodo: 'ANUAL' }, 'Período deve ser SEMANAL, MENSAL, PERSONALIZADO ou CAMPANHA.'],
    ['data dd/mm', { inicio: '05/10/2026' }, 'Data de início inválida.'],
    ['data que não existe', { fim: '2026-02-30' }, 'Data de fim inválida.'],
    ['sem representante', { representanteId: undefined }, 'Escolha um representante.'],
  ])('%s → 400', async (_caso, overrides, mensagem) => {
    const res = await criarMeta(overrides);

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain(mensagem);
    expect(await prisma.goal.count()).toBe(0);
  });

  it('campo desconhecido → 400 "Dados inválidos." com o detalhe na raiz do corpo', async () => {
    const res = await criarMeta({ extra: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Dados inválidos.');
    expect(res.body.error.details.map((detalhe: { path: string }) => detalhe.path)).toEqual(['']);
    expect(await prisma.goal.count()).toBe(0);
  });

  it('representante que não existe ou que é gestor → 400 "Escolha um representante."', async () => {
    const inexistente = await criarMeta({ representanteId: ID_INEXISTENTE });
    const gestor = await criarMeta({ representanteId: gestorId });

    for (const res of [inexistente, gestor]) {
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Escolha um representante.');
    }
    expect(await prisma.goal.count()).toBe(0);
  });

  it('representante inativo → 400 "Representante inativo."', async () => {
    const res = await criarMeta({ representanteId: anaId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Representante inativo.');
  });

  it('o banco também recusa meta negativa, fim antes do início e campanha fora do período CAMPANHA', async () => {
    const base = {
      representanteId: eduardaId,
      periodo: 'PERSONALIZADO' as const,
      inicio: new Date('2026-10-05T00:00:00.000Z'),
      fim: new Date('2026-10-20T00:00:00.000Z'),
      metaVisitas: 1,
      metaVendas: 1,
    };
    const natalId = await criarCampanha('2026-10-01', '2026-12-24');

    await expect(prisma.goal.create({ data: { ...base, metaVisitas: -1 } })).rejects.toThrow();
    await expect(prisma.goal.create({ data: { ...base, metaVendas: -1 } })).rejects.toThrow();
    await expect(
      prisma.goal.create({ data: { ...base, fim: new Date('2026-10-04T00:00:00.000Z') } }),
    ).rejects.toThrow();
    await expect(prisma.goal.create({ data: { ...base, campanhaId: natalId } })).rejects.toThrow();
    await expect(prisma.goal.create({ data: { ...base, periodo: 'CAMPANHA' } })).rejects.toThrow();
    expect(await prisma.goal.count()).toBe(0);
  });

  describe('meta de campanha', () => {
    let natalId: string;

    beforeEach(async () => {
      natalId = await criarCampanha('2026-11-01', '2026-12-24');
    });

    it('cria dentro do período da campanha (inclusive as duas pontas)', async () => {
      const res = await criarMeta({
        periodo: 'CAMPANHA',
        campanhaId: natalId,
        inicio: '2026-11-01',
        fim: '2026-12-24',
      });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        dtoDaMeta(await idDaUnicaMeta(), {
          periodo: 'CAMPANHA',
          campanhaId: natalId,
          inicio: '2026-11-01',
          fim: '2026-12-24',
        }),
      );
    });

    it.each([
      ['começa antes', '2026-10-31', '2026-12-24'],
      ['termina depois', '2026-11-01', '2026-12-25'],
    ])('%s do período → 400 com a mensagem', async (_caso, inicio, fim) => {
      const res = await criarMeta({ periodo: 'CAMPANHA', campanhaId: natalId, inicio, fim });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('A meta deve ficar dentro do período da campanha.');
      expect(await prisma.goal.count()).toBe(0);
    });

    it('campanha que não existe → 400', async () => {
      const res = await criarMeta({
        periodo: 'CAMPANHA',
        campanhaId: ID_INEXISTENTE,
        inicio: '2026-11-01',
        fim: '2026-11-02',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Campanha não encontrada.');
    });

    it('período CAMPANHA sem campanhaId → 400', async () => {
      const res = await criarMeta({ periodo: 'CAMPANHA', inicio: '2026-11-01', fim: '2026-11-02' });

      expect(res.status).toBe(400);
      expect(mensagensDoErro(res)).toContain('Informe a campanha da meta.');
    });

    it('campanhaId com outro período → 400', async () => {
      const res = await criarMeta({
        periodo: 'PERSONALIZADO',
        campanhaId: natalId,
        inicio: '2026-11-01',
        fim: '2026-11-02',
      });

      expect(res.status).toBe(400);
      expect(mensagensDoErro(res)).toContain('Só a meta por campanha pode ter campanha.');
    });
  });
});

describe('GET /goals', () => {
  it('responde 401 sem token', async () => {
    const res = await request(app).get('/goals');

    expect(res.status).toBe(401);
  });

  it('realizado: visitas da autora no período (fuso de São Paulo, pontas inclusivas) e vendas só das com VENDA', async () => {
    const meta = (await criarMeta({ inicio: '2026-10-05', fim: '2026-10-20' })).body;
    // Contam: venda de 10 × 42 + 3 × 27,90 = 503,70; negociação (só como visita); 23:30 do dia do fim
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-05T00:05:00.000-03:00',
      itens: [
        { quantidade: 10, precoUnitario: 42 },
        { quantidade: 3, precoUnitario: 27.9 },
      ],
    });
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-12T10:00:00.000-03:00',
      resultado: 'NEGOCIACAO',
    });
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-20T23:30:00.000-03:00',
      itens: [{ quantidade: 1, precoUnitario: 96.3 }],
    });
    // Não contam: 00:10 do dia seguinte ao fim, véspera do início, outro autor
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-21T00:10:00.000-03:00',
      itens: [{ quantidade: 1, precoUnitario: 1000 }],
    });
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-04T23:50:00.000-03:00',
      itens: [{ quantidade: 1, precoUnitario: 1000 }],
    });
    await criarVisita({
      clientId: clienteDoRafaelId,
      userId: rafaelId,
      dataHora: '2026-10-10T10:00:00.000-03:00',
      itens: [{ quantidade: 1, precoUnitario: 1000 }],
    });

    const res = await autenticado(request(app).get('/goals'), tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      {
        ...meta,
        realizado: {
          visitas: 3,
          vendas: 600,
          clientes: [{ id: clienteDaEduardaId, nomeFantasia: 'Emporio Pomerode', visitas: 3, vendas: 600 }],
        },
      },
    ]);
  });

  it('realizado.clientes: um item por cliente visitado, com vendas desc, visitas desc e nome', async () => {
    await criarMeta({ inicio: '2026-10-05', fim: '2026-10-20' });
    const zeca = await criarCliente(eduardaId, 'Zeca Doces');
    const acai = await criarCliente(eduardaId, 'Acai Bom');
    const visitas = [
      { clientId: zeca, dia: '2026-10-06', itens: [{ quantidade: 1, precoUnitario: 30 }] },
      { clientId: clienteDaEduardaId, dia: '2026-10-07', itens: [{ quantidade: 1, precoUnitario: 80 }] },
      { clientId: acai, dia: '2026-10-08', resultado: 'NEGOCIACAO' as const },
      { clientId: acai, dia: '2026-10-09', resultado: 'SEM_VENDA' as const },
      { clientId: zeca, dia: '2026-10-10', resultado: 'SEM_VENDA' as const },
    ];
    for (const { dia, ...visita } of visitas) {
      await criarVisita({ ...visita, userId: eduardaId, dataHora: `${dia}T10:00:00.000-03:00` });
    }

    const res = await autenticado(request(app).get('/goals'), tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.data[0].realizado.clientes).toEqual([
      { id: clienteDaEduardaId, nomeFantasia: 'Emporio Pomerode', visitas: 1, vendas: 80 },
      { id: zeca, nomeFantasia: 'Zeca Doces', visitas: 2, vendas: 30 },
      { id: acai, nomeFantasia: 'Acai Bom', visitas: 2, vendas: 0 },
    ]);
  });

  it('meta de campanha: só as visitas vinculadas à campanha contam', async () => {
    const natalId = await criarCampanha('2026-10-01', '2026-12-24');
    const meta = (
      await criarMeta({ periodo: 'CAMPANHA', campanhaId: natalId, inicio: '2026-10-01', fim: '2026-12-24' })
    ).body;
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-15T10:00:00.000-03:00',
      campanhaId: natalId,
      itens: [{ quantidade: 10, precoUnitario: 42 }],
    });
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      dataHora: '2026-10-16T10:00:00.000-03:00',
      itens: [{ quantidade: 1, precoUnitario: 500 }],
    });

    const res = await autenticado(request(app).get(`/goals?campanhaId=${natalId}`), tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: meta.id,
        realizado: {
          visitas: 1,
          vendas: 420,
          clientes: [{ id: clienteDaEduardaId, nomeFantasia: 'Emporio Pomerode', visitas: 1, vendas: 420 }],
        },
      }),
    ]);
  });

  it('sem campanhaId, só as metas sem campanha; com ele, só as daquela campanha', async () => {
    const natalId = await criarCampanha('2026-11-01', '2026-12-24');
    const pascoaId = await criarCampanha('2027-03-01', '2027-04-05', 'Páscoa');
    const semCampanha = (await criarMeta()).body;
    const doNatal = (
      await criarMeta({ periodo: 'CAMPANHA', campanhaId: natalId, inicio: '2026-11-01', fim: '2026-12-24' })
    ).body;
    await criarMeta({ periodo: 'CAMPANHA', campanhaId: pascoaId, inicio: '2027-03-01', fim: '2027-04-05' });

    const geral = await autenticado(request(app).get('/goals'), tokenGestor);
    const natal = await autenticado(request(app).get(`/goals?campanhaId=${natalId}`), tokenGestor);

    expect(geral.body.data.map((meta: { id: string }) => meta.id)).toEqual([semCampanha.id]);
    expect(natal.body.data.map((meta: { id: string }) => meta.id)).toEqual([doNatal.id]);
  });

  it('com ?inicio&fim lista só as metas que cruzam a janela (pontas inclusivas); sem período, todas', async () => {
    const setembro = (await criarMeta({ periodo: 'MENSAL', inicio: '2025-09-01', fim: '2025-09-30' })).body;
    const outubro = (await criarMeta({ periodo: 'MENSAL', inicio: '2025-10-01', fim: '2025-10-31' })).body;
    const novembro = (await criarMeta({ periodo: 'MENSAL', inicio: '2025-11-01', fim: '2025-11-30' })).body;
    const ids = (res: request.Response) => res.body.data.map((meta: { id: string }) => meta.id);
    // Tudo em 2025: no passado, para o fim nunca passar de hoje.
    const listar = (query: string) => autenticado(request(app).get(`/goals${query}`), tokenGestor);

    const cruzaSoOutubro = await listar('?inicio=2025-10-10&fim=2025-10-20');
    const tocaNaPontaDeSetembro = await listar('?inicio=2025-09-30&fim=2025-10-01');
    const entreSetembroENovembro = await listar('?inicio=2025-10-31&fim=2025-11-01');
    const foraDeTodas = await listar('?inicio=2025-01-01&fim=2025-01-31');
    const semPeriodo = await listar('');

    expect(cruzaSoOutubro.status).toBe(200);
    expect(ids(cruzaSoOutubro)).toEqual([outubro.id]);
    expect(ids(tocaNaPontaDeSetembro)).toEqual([outubro.id, setembro.id]);
    expect(ids(entreSetembroENovembro)).toEqual([novembro.id, outubro.id]);
    expect(ids(foraDeTodas)).toEqual([]);
    expect(ids(semPeriodo)).toEqual([novembro.id, outubro.id, setembro.id]);
  });

  it('o período da lista segue as regras do Painel (dias ou datas, não os dois; as duas datas; sem teto)', async () => {
    const listar = (query: string) => autenticado(request(app).get(`/goals${query}`), tokenGestor);

    const osDois = await listar('?periodoDias=30&inicio=2025-10-01&fim=2025-10-10');
    const umaData = await listar('?inicio=2025-10-01');
    const fimAntes = await listar('?inicio=2025-10-10&fim=2025-10-01');
    const noFuturo = await listar('?inicio=2025-10-01&fim=2099-01-01');
    const porDias = await listar('?periodoDias=90');
    const muitoLonga = await listar('?inicio=2020-01-01&fim=2025-01-01');

    expect(osDois.status).toBe(400);
    expect(mensagensDoErro(osDois)).toEqual(['Informe o período em dias ou por datas, não os dois.']);
    expect(umaData.status).toBe(400);
    expect(mensagensDoErro(umaData)).toEqual(['Informe o início e o fim do período.']);
    expect(fimAntes.status).toBe(400);
    expect(mensagensDoErro(fimAntes)).toEqual(['A data de fim deve ser depois do início.']);
    expect(noFuturo.status).toBe(400);
    expect(noFuturo.body.error.message).toBe('A data de fim não pode ser depois de hoje.');
    expect(porDias.status).toBe(200);
    expect(muitoLonga.status).toBe(200);
  });

  it('o gestor vê todas ou filtra pelo representante', async () => {
    const daEduarda = (await criarMeta()).body;
    const doRafael = (await criarMeta({ representanteId: rafaelId })).body;

    const todas = await autenticado(request(app).get('/goals'), tokenGestor);
    const soRafael = await autenticado(request(app).get(`/goals?representanteId=${rafaelId}`), tokenGestor);

    expect(todas.body.data.map((meta: { id: string }) => meta.id).sort()).toEqual([daEduarda.id, doRafael.id].sort());
    expect(soRafael.body.data.map((meta: { id: string }) => meta.id)).toEqual([doRafael.id]);
  });

  it('o representante vê só as próprias, mesmo pedindo as de outro', async () => {
    const daEduarda = (await criarMeta()).body;
    await criarMeta({ representanteId: rafaelId });

    const proprias = await autenticado(request(app).get('/goals'), tokenEduarda);
    const pedindoOutro = await autenticado(request(app).get(`/goals?representanteId=${rafaelId}`), tokenEduarda);

    expect(proprias.status).toBe(200);
    expect(proprias.body.data.map((meta: { id: string }) => meta.id)).toEqual([daEduarda.id]);
    expect(pedindoOutro.body.data.map((meta: { id: string }) => meta.id)).toEqual([daEduarda.id]);
  });

  it('ordena do período mais recente para o mais antigo', async () => {
    const outubro = (await criarMeta({ periodo: 'MENSAL', inicio: '2026-10-01', fim: '2026-10-31' })).body;
    const novembro = (await criarMeta({ periodo: 'MENSAL', inicio: '2026-11-01', fim: '2026-11-30' })).body;
    const setembro = (await criarMeta({ periodo: 'MENSAL', inicio: '2026-09-01', fim: '2026-09-30' })).body;

    const res = await autenticado(request(app).get('/goals'), tokenGestor);

    expect(res.body.data.map((meta: { id: string }) => meta.id)).toEqual([novembro.id, outubro.id, setembro.id]);
  });

  it('a meta de um representante que foi inativado continua na lista', async () => {
    const meta = (await criarMeta()).body;
    await prisma.user.update({ where: { id: eduardaId }, data: { ativo: false } });

    const res = await autenticado(request(app).get('/goals'), tokenGestor);

    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual([meta.id]);
  });

  it('representanteId que não é UUID → 400 "Identificador do representante inválido."', async () => {
    const res = await autenticado(request(app).get('/goals?representanteId=abc'), tokenGestor);

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toEqual(['Identificador do representante inválido.']);
  });
});

describe('PUT /goals/:id', () => {
  it('o gestor troca a meta inteira (200) e recebe o realizado do novo período', async () => {
    const meta = (await criarMeta()).body;
    await criarVisita({
      clientId: clienteDoRafaelId,
      userId: rafaelId,
      dataHora: '2026-11-10T10:00:00.000-03:00',
      itens: [{ quantidade: 2, precoUnitario: 48 }],
    });

    const res = await autenticado(request(app).put(`/goals/${meta.id}`), tokenGestor).send(
      corpoDaMeta({
        representanteId: rafaelId,
        periodo: 'MENSAL',
        inicio: '2026-11-20',
        fim: '2026-11-20',
        metaVisitas: 5,
        metaVendas: 900,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: meta.id,
      representante: { id: rafaelId, nome: RAFAEL.nome },
      periodo: 'MENSAL',
      inicio: '2026-11-01',
      fim: '2026-11-30',
      metaVisitas: 5,
      metaVendas: 900,
      campanhaId: null,
      realizado: {
        visitas: 1,
        vendas: 96,
        clientes: [{ id: clienteDoRafaelId, nomeFantasia: 'Cafe Blumenau', visitas: 1, vendas: 96 }],
      },
    });
  });

  it('mantém o representante que foi inativado (não é trocar para um inativo)', async () => {
    const meta = (await criarMeta()).body;
    await prisma.user.update({ where: { id: eduardaId }, data: { ativo: false } });

    const res = await autenticado(request(app).put(`/goals/${meta.id}`), tokenGestor).send(
      corpoDaMeta({ metaVisitas: 20 }),
    );

    expect(res.status).toBe(200);
    expect(res.body.metaVisitas).toBe(20);
  });

  it('trocar para um representante inativo → 400', async () => {
    const meta = (await criarMeta()).body;

    const res = await autenticado(request(app).put(`/goals/${meta.id}`), tokenGestor).send(
      corpoDaMeta({ representanteId: anaId }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Representante inativo.');
  });

  it('o representante não altera (403) e a meta não muda', async () => {
    const meta = (await criarMeta()).body;

    const res = await autenticado(request(app).put(`/goals/${meta.id}`), tokenEduarda).send(
      corpoDaMeta({ metaVisitas: 99 }),
    );

    expect(res.status).toBe(403);
    expect((await prisma.goal.findUniqueOrThrow({ where: { id: meta.id } })).metaVisitas).toBe(12);
  });

  it('valida como na criação', async () => {
    const meta = (await criarMeta()).body;

    const res = await autenticado(request(app).put(`/goals/${meta.id}`), tokenGestor).send(
      corpoDaMeta({ inicio: '2026-10-20', fim: '2026-10-01' }),
    );

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain('A data de fim deve ser depois do início.');
  });

  it('responde 404 para meta inexistente', async () => {
    const res = await autenticado(request(app).put(`/goals/${ID_INEXISTENTE}`), tokenGestor).send(corpoDaMeta());

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Meta não encontrada.');
  });
});

describe('DELETE /goals/:id', () => {
  it('o gestor exclui (204)', async () => {
    const meta = (await criarMeta()).body;

    const res = await autenticado(request(app).delete(`/goals/${meta.id}`), tokenGestor);

    expect(res.status).toBe(204);
    expect(await prisma.goal.count()).toBe(0);
  });

  it('o representante não exclui (403) e a meta continua', async () => {
    const meta = (await criarMeta()).body;

    const res = await autenticado(request(app).delete(`/goals/${meta.id}`), tokenEduarda);

    expect(res.status).toBe(403);
    expect(await prisma.goal.count()).toBe(1);
  });

  it('responde 404 para meta inexistente', async () => {
    const res = await autenticado(request(app).delete(`/goals/${ID_INEXISTENTE}`), tokenGestor);

    expect(res.status).toBe(404);
  });
});
