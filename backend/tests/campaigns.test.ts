import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const GESTOR = { nome: 'Maicon Krüger', email: 'maicon.campaigns-teste@chokolaten.com.br', role: 'GESTOR' as const };
const EDUARDA = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.campaigns-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};
const RAFAEL = {
  nome: 'Rafael Schmitt',
  email: 'rafael.campaigns-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};
const ANA_INATIVA = {
  nome: 'Ana Souza',
  email: 'ana.campaigns-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
  ativo: false,
};
const BRUNO_INATIVO = {
  nome: 'Bruno Alencar',
  email: 'bruno.campaigns-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
  ativo: false,
};

let tokenGestor: string;
let tokenEduarda: string;
let eduardaId: string;
let rafaelId: string;
let anaId: string;
let clienteDaEduardaId: string;
let clienteDoRafaelId: string;

/** Hoje + `dias`, como data de calendário em São Paulo (o "hoje" do servidor). */
function daquiA(dias: number): string {
  return somarDias(dataCalendario(new Date()), dias);
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

let proximoCnpj = 0;

async function criarCliente(representanteId: string, nomeFantasia: string): Promise<string> {
  proximoCnpj += 1;
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj: String(11222333000100 + proximoCnpj),
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: 'contato@cliente-campaigns-teste.com.br',
      representanteId,
    },
  });
  return cliente.id;
}

function autenticado(req: request.Test, token: string): request.Test {
  return req.set('Authorization', `Bearer ${token}`);
}

function corpoDaCampanha(overrides: Record<string, unknown> = {}) {
  return {
    nome: 'Natal Chokolaten',
    tipo: 'CAMPANHA',
    inicio: daquiA(-5),
    fim: daquiA(30),
    descricao: 'Kits de Natal com 15% para pedidos acima de 20 caixas.',
    desconto: 15,
    produtos: ['CX-PRESENTE', 'BOMB-SORT'],
    ...overrides,
  };
}

async function criarCampanha(overrides: Record<string, unknown> = {}): Promise<request.Response> {
  return autenticado(request(app).post('/campaigns'), tokenGestor).send(corpoDaCampanha(overrides));
}

/** Visita gravada direto no banco, com o pedido já resolvido (nome e preço do catálogo). */
async function criarVisita(params: {
  clientId: string;
  userId: string;
  campanhaId: string | null;
  resultado: 'VENDA' | 'NEGOCIACAO' | 'SEM_VENDA';
  itens?: { sku: string; produtoNome: string; quantidade: number; precoUnitario: number }[];
}): Promise<string> {
  const { itens = [], ...dados } = params;
  const visita = await prisma.visit.create({
    data: {
      ...dados,
      dataHora: new Date(),
      descricao: 'Visita de teste das campanhas.',
      ...(itens.length > 0 ? { itens: { create: itens } } : {}),
    },
  });
  return visita.id;
}

/** Detalhes do erro de validação do zod: `{ path, message }[]`. */
function mensagensDoErro(res: request.Response): string[] {
  return (res.body.error.details ?? []).map((detalhe: { message: string }) => detalhe.message);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });
  eduardaId = (await prisma.user.create({ data: { ...EDUARDA, senhaHash } })).id;
  rafaelId = (await prisma.user.create({ data: { ...RAFAEL, senhaHash } })).id;
  anaId = (await prisma.user.create({ data: { ...ANA_INATIVA, senhaHash } })).id;
  await prisma.user.create({ data: { ...BRUNO_INATIVO, senhaHash } });

  tokenGestor = await logar(GESTOR.email);
  tokenEduarda = await logar(EDUARDA.email);

  clienteDaEduardaId = await criarCliente(eduardaId, 'Emporio Pomerode');
  clienteDoRafaelId = await criarCliente(rafaelId, 'Cafe Blumenau');
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('POST /campaigns', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).post('/campaigns').send(corpoDaCampanha());

    expect(res.status).toBe(401);
  });

  it('o gestor cria a campanha (201) com status, nomes dos produtos e os representantes ativos zerados', async () => {
    const res = await criarCampanha({ nome: '  Natal Chokolaten  ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      nome: 'Natal Chokolaten',
      tipo: 'CAMPANHA',
      inicio: daquiA(-5),
      fim: daquiA(30),
      descricao: 'Kits de Natal com 15% para pedidos acima de 20 caixas.',
      desconto: 15,
      produtos: [
        { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida' },
        { sku: 'BOMB-SORT', nome: 'Bombons sortidos' },
      ],
      status: 'EM_ANDAMENTO',
      resultados: [
        { representante: { id: eduardaId, nome: 'Eduarda Fischer' }, vendas: 0, visitas: 0 },
        { representante: { id: rafaelId, nome: 'Rafael Schmitt' }, vendas: 0, visitas: 0 },
      ],
    });

    const gravada = await prisma.campaign.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(gravada.inicio.toISOString().slice(0, 10)).toBe(daquiA(-5));
    expect(gravada.fim.toISOString().slice(0, 10)).toBe(daquiA(30));
  });

  it('só o obrigatório: sem descrição, sem desconto e sem produtos', async () => {
    const res = await autenticado(request(app).post('/campaigns'), tokenGestor).send({
      nome: 'Feira Sabores do Vale',
      tipo: 'EVENTO',
      inicio: daquiA(10),
      fim: daquiA(10),
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ descricao: '', desconto: null, produtos: [], status: 'PROGRAMADA' });
  });

  it('SKU repetido vira um só', async () => {
    const res = await criarCampanha({ produtos: ['BOMB-SORT', 'BOMB-SORT'] });

    expect(res.status).toBe(201);
    expect(res.body.produtos).toEqual([{ sku: 'BOMB-SORT', nome: 'Bombons sortidos' }]);
  });

  it('o representante não cria (403) e nada é gravado', async () => {
    const res = await autenticado(request(app).post('/campaigns'), tokenEduarda).send(corpoDaCampanha());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(await prisma.campaign.count()).toBe(0);
  });

  it('recusa nome em branco', async () => {
    const res = await criarCampanha({ nome: '   ' });

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain('Dê um nome à campanha.');
    expect(await prisma.campaign.count()).toBe(0);
  });

  it('recusa fim antes do início', async () => {
    const res = await criarCampanha({ inicio: daquiA(10), fim: daquiA(9) });

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain('A data de fim deve ser depois do início.');
    expect(await prisma.campaign.count()).toBe(0);
  });

  it.each([
    ['acima de 100', 101],
    ['negativo', -1],
    ['quebrado', 12.5],
    ['em texto', '15'],
  ])('recusa desconto %s', async (_rotulo, desconto) => {
    const res = await criarCampanha({ desconto });

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain('O desconto deve ser um número inteiro de 0 a 100.');
  });

  it('aceita desconto 0 e 100', async () => {
    expect((await criarCampanha({ desconto: 0 })).body.desconto).toBe(0);
    expect((await criarCampanha({ desconto: 100 })).body.desconto).toBe(100);
  });

  it('recusa SKU fora do catálogo sem gravar', async () => {
    const res = await criarCampanha({ produtos: ['BOMB-SORT', 'NAO-EXISTE'] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Produto não encontrado no catálogo.');
    expect(await prisma.campaign.count()).toBe(0);
  });

  it.each([
    ['tipo fora do enum', { tipo: 'LIQUIDACAO' }],
    ['data no formato brasileiro', { inicio: '01/11/2026' }],
    ['data que não existe', { fim: '2027-02-30' }],
    ['campo desconhecido', { criadoPor: 'eu' }],
  ])('recusa %s', async (_rotulo, overrides) => {
    const res = await criarCampanha(overrides);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('CHECKs da migration (última linha de defesa, além do zod)', () => {
  function gravarDireto(dados: { inicio: string; fim: string; desconto: number | null }) {
    return prisma.campaign.create({
      data: {
        nome: 'Direto no banco',
        tipo: 'CAMPANHA',
        inicio: new Date(`${dados.inicio}T00:00:00.000Z`),
        fim: new Date(`${dados.fim}T00:00:00.000Z`),
        desconto: dados.desconto,
        produtos: [],
      },
    });
  }

  it('o banco recusa desconto fora de 0–100', async () => {
    await expect(gravarDireto({ inicio: '2026-11-01', fim: '2026-11-30', desconto: 101 })).rejects.toThrow();
  });

  it('o banco recusa fim antes do início', async () => {
    await expect(gravarDireto({ inicio: '2026-11-30', fim: '2026-11-01', desconto: null })).rejects.toThrow();
  });
});

describe('GET /campaigns', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/campaigns');

    expect(res.status).toBe(401);
  });

  it('lista em ordem de início, com o status de cada uma (início e fim inclusivos)', async () => {
    await criarCampanha({ nome: 'Feira Sabores do Vale', tipo: 'EVENTO', inicio: daquiA(1), fim: daquiA(3) });
    await criarCampanha({ nome: 'Páscoa', tipo: 'PROMOCAO', inicio: daquiA(-60), fim: daquiA(-1) });
    await criarCampanha({ nome: 'Black Friday do Cacau', tipo: 'PROMOCAO', inicio: daquiA(0), fim: daquiA(0) });

    const res = await autenticado(request(app).get('/campaigns'), tokenGestor);

    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { nome: string; status: string }) => [c.nome, c.status])).toEqual([
      ['Páscoa', 'ENCERRADA'],
      ['Black Friday do Cacau', 'EM_ANDAMENTO'],
      ['Feira Sabores do Vale', 'PROGRAMADA'],
    ]);
  });

  it('vendas vinculadas = soma dos pedidos das visitas VENDA da campanha, por autor; visitas = todas as vinculadas', async () => {
    const natal = (await criarCampanha()).body.id as string;
    const outra = (await criarCampanha({ nome: 'Black Friday do Cacau' })).body.id as string;

    // Eduarda: venda de 10 × 42 + 3 × 27,90 = 503,70; uma negociação vinculada
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      campanhaId: natal,
      resultado: 'VENDA',
      itens: [
        { sku: 'BOMB-SORT', produtoNome: 'Bombons sortidos', quantidade: 10, precoUnitario: 42 },
        { sku: 'PAO-MEL', produtoNome: 'Pães de mel', quantidade: 3, precoUnitario: 27.9 },
      ],
    });
    await criarVisita({ clientId: clienteDaEduardaId, userId: eduardaId, campanhaId: natal, resultado: 'NEGOCIACAO' });
    // Fora da conta do Natal: outra campanha e visita sem campanha
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      campanhaId: outra,
      resultado: 'VENDA',
      itens: [{ sku: 'BARRA-70', produtoNome: 'Barra de chocolate 70% cacau', quantidade: 5, precoUnitario: 18 }],
    });
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      campanhaId: null,
      resultado: 'VENDA',
      itens: [{ sku: 'BARRA-70', produtoNome: 'Barra de chocolate 70% cacau', quantidade: 100, precoUnitario: 18 }],
    });
    // Rafael: 2 × 48 = 96
    await criarVisita({
      clientId: clienteDoRafaelId,
      userId: rafaelId,
      campanhaId: natal,
      resultado: 'VENDA',
      itens: [{ sku: 'CX-PRESENTE', produtoNome: 'Caixa presente sortida', quantidade: 2, precoUnitario: 48 }],
    });
    // Ana (inativa) tem visita vinculada: aparece; Bruno (inativo, sem visita) não
    await criarVisita({
      clientId: clienteDoRafaelId,
      userId: anaId,
      campanhaId: natal,
      resultado: 'SEM_VENDA',
    });

    const res = await autenticado(request(app).get('/campaigns'), tokenGestor);

    const campanhaNatal = res.body.data.find((c: { id: string }) => c.id === natal);
    expect(campanhaNatal.resultados).toEqual([
      { representante: { id: anaId, nome: 'Ana Souza' }, vendas: 0, visitas: 1 },
      { representante: { id: eduardaId, nome: 'Eduarda Fischer' }, vendas: 503.7, visitas: 2 },
      { representante: { id: rafaelId, nome: 'Rafael Schmitt' }, vendas: 96, visitas: 1 },
    ]);
    const campanhaOutra = res.body.data.find((c: { id: string }) => c.id === outra);
    expect(campanhaOutra.resultados).toEqual([
      { representante: { id: eduardaId, nome: 'Eduarda Fischer' }, vendas: 90, visitas: 1 },
      { representante: { id: rafaelId, nome: 'Rafael Schmitt' }, vendas: 0, visitas: 0 },
    ]);
  });

  it('o representante lê (200) e recebe só a própria linha em resultados', async () => {
    const natal = (await criarCampanha()).body.id as string;
    await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      campanhaId: natal,
      resultado: 'VENDA',
      itens: [{ sku: 'BOMB-SORT', produtoNome: 'Bombons sortidos', quantidade: 1, precoUnitario: 42 }],
    });
    await criarVisita({
      clientId: clienteDoRafaelId,
      userId: rafaelId,
      campanhaId: natal,
      resultado: 'VENDA',
      itens: [{ sku: 'CX-PRESENTE', produtoNome: 'Caixa presente sortida', quantidade: 2, precoUnitario: 48 }],
    });

    const res = await autenticado(request(app).get('/campaigns'), tokenEduarda);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].resultados).toEqual([
      { representante: { id: eduardaId, nome: 'Eduarda Fischer' }, vendas: 42, visitas: 1 },
    ]);
  });

  it('representante sem visita vinculada recebe a própria linha zerada', async () => {
    await criarCampanha();

    const res = await autenticado(request(app).get('/campaigns'), tokenEduarda);

    expect(res.body.data[0].resultados).toEqual([
      { representante: { id: eduardaId, nome: 'Eduarda Fischer' }, vendas: 0, visitas: 0 },
    ]);
  });
});

describe('PUT /campaigns/:id', () => {
  it('o gestor altera a campanha inteira (200)', async () => {
    const id = (await criarCampanha()).body.id as string;

    const res = await autenticado(request(app).put(`/campaigns/${id}`), tokenGestor).send({
      nome: 'Natal Chokolaten 2026',
      tipo: 'PROMOCAO',
      inicio: daquiA(5),
      fim: daquiA(40),
      produtos: ['TRUF-70'],
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      nome: 'Natal Chokolaten 2026',
      tipo: 'PROMOCAO',
      inicio: daquiA(5),
      fim: daquiA(40),
      descricao: '',
      desconto: null,
      produtos: [{ sku: 'TRUF-70', nome: 'Trufas 70% cacau' }],
      status: 'PROGRAMADA',
    });
  });

  it('o representante não altera (403) e nada muda', async () => {
    const id = (await criarCampanha()).body.id as string;

    const res = await autenticado(request(app).put(`/campaigns/${id}`), tokenEduarda).send(
      corpoDaCampanha({ nome: 'Outro nome' }),
    );

    expect(res.status).toBe(403);
    expect((await prisma.campaign.findUniqueOrThrow({ where: { id } })).nome).toBe('Natal Chokolaten');
  });

  it('aplica as mesmas validações da criação', async () => {
    const id = (await criarCampanha()).body.id as string;

    const res = await autenticado(request(app).put(`/campaigns/${id}`), tokenGestor).send(
      corpoDaCampanha({ inicio: daquiA(3), fim: daquiA(2) }),
    );

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain('A data de fim deve ser depois do início.');
  });

  it('recusa SKU fora do catálogo na alteração', async () => {
    const id = (await criarCampanha()).body.id as string;

    const res = await autenticado(request(app).put(`/campaigns/${id}`), tokenGestor).send(
      corpoDaCampanha({ produtos: ['NAO-EXISTE'] }),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Produto não encontrado no catálogo.');
  });

  it('responde 404 para campanha inexistente', async () => {
    const res = await autenticado(request(app).put(`/campaigns/${ID_INEXISTENTE}`), tokenGestor).send(
      corpoDaCampanha(),
    );

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Campanha não encontrada.');
  });
});

describe('DELETE /campaigns/:id', () => {
  it('o gestor exclui (204); visitas e próximas visitas ficam sem a campanha, e nada mais se perde', async () => {
    const id = (await criarCampanha()).body.id as string;
    const visitaId = await criarVisita({
      clientId: clienteDaEduardaId,
      userId: eduardaId,
      campanhaId: id,
      resultado: 'VENDA',
      itens: [{ sku: 'BOMB-SORT', produtoNome: 'Bombons sortidos', quantidade: 1, precoUnitario: 42 }],
    });
    await prisma.client.update({
      where: { id: clienteDaEduardaId },
      data: { proximaCampanhaId: id, proximaVisita: new Date(`${daquiA(7)}T00:00:00.000Z`) },
    });

    const res = await autenticado(request(app).delete(`/campaigns/${id}`), tokenGestor);

    expect(res.status).toBe(204);
    expect(await prisma.campaign.count()).toBe(0);
    const visita = await prisma.visit.findUniqueOrThrow({ where: { id: visitaId }, include: { itens: true } });
    expect(visita.campanhaId).toBeNull();
    expect(visita.itens).toHaveLength(1);
    const cliente = await prisma.client.findUniqueOrThrow({ where: { id: clienteDaEduardaId } });
    expect(cliente.proximaCampanhaId).toBeNull();
    expect(cliente.proximaVisita?.toISOString().slice(0, 10)).toBe(daquiA(7));
  });

  it('excluir a campanha apaga as metas dela; as outras metas ficam', async () => {
    const id = (await criarCampanha()).body.id as string;
    const metaDaCampanha = await autenticado(request(app).post('/goals'), tokenGestor).send({
      representanteId: eduardaId,
      periodo: 'CAMPANHA',
      campanhaId: id,
      inicio: daquiA(-5),
      fim: daquiA(30),
      metaVisitas: 10,
      metaVendas: 5000,
    });
    const metaSemCampanha = await autenticado(request(app).post('/goals'), tokenGestor).send({
      representanteId: eduardaId,
      periodo: 'PERSONALIZADO',
      inicio: daquiA(-5),
      fim: daquiA(30),
      metaVisitas: 10,
      metaVendas: 5000,
    });
    expect([metaDaCampanha.status, metaSemCampanha.status]).toEqual([201, 201]);

    const res = await autenticado(request(app).delete(`/campaigns/${id}`), tokenGestor);

    expect(res.status).toBe(204);
    const metas = await prisma.goal.findMany({ select: { id: true } });
    expect(metas).toEqual([{ id: metaSemCampanha.body.id }]);
  });

  it('o representante não exclui (403) e a campanha continua', async () => {
    const id = (await criarCampanha()).body.id as string;

    const res = await autenticado(request(app).delete(`/campaigns/${id}`), tokenEduarda);

    expect(res.status).toBe(403);
    expect(await prisma.campaign.count()).toBe(1);
  });

  it('responde 404 para campanha inexistente', async () => {
    const res = await autenticado(request(app).delete(`/campaigns/${ID_INEXISTENTE}`), tokenGestor);

    expect(res.status).toBe(404);
  });
});
