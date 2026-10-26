import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

/**
 * Lembrete como tarefa própria (Etapa 9): criado no check-in com data
 * própria, sobrevive a check-ins novos e à próxima visita apagada, listado
 * por cliente (só os abertos) e concluído pelo dono da carteira ou pelo
 * gestor.
 */

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const GESTOR = { nome: 'Maicon Krüger', email: 'maicon.lembretes-teste@chokolaten.com.br', role: 'GESTOR' as const };
const EDUARDA = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.lembretes-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};
const RAFAEL = {
  nome: 'Rafael Schmitt',
  email: 'rafael.lembretes-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

let tokenGestor: string;
let tokenEduarda: string;
let tokenRafael: string;
let eduardaId: string;
let rafaelId: string;
let clienteId: string;
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
      cnpj: String(33444555000100 + proximoCnpj),
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: 'contato@cliente-lembretes-teste.com.br',
      representanteId,
    },
  });
  return cliente.id;
}

/** Hoje + `dias`, como data de calendário em São Paulo (o "hoje" do servidor). */
function daquiA(dias: number): string {
  return somarDias(dataCalendario(new Date()), dias);
}

/** Lembrete gravado direto no banco (`@db.Date` = meia-noite UTC). */
async function criarLembrete(params: {
  clientId: string;
  criadoPorId: string;
  texto: string;
  data: string;
  concluidoEm?: Date;
}): Promise<string> {
  const { data, ...dados } = params;
  const lembrete = await prisma.reminder.create({ data: { ...dados, data: new Date(`${data}T00:00:00.000Z`) } });
  return lembrete.id;
}

function checkIn(corpo: Record<string, unknown> = {}, token = tokenEduarda, cliente = clienteId) {
  return autenticado(request(app).post(`/clients/${cliente}/visits`), token).send({
    descricao: 'Reposição do mostruário e pedido de trufas.',
    resultado: 'NEGOCIACAO',
    ...corpo,
  });
}

/** Detalhes do erro de validação do zod: `{ path, message }[]`. */
function mensagensDoErro(res: request.Response): string[] {
  return (res.body.error.details ?? []).map((detalhe: { message: string }) => detalhe.message);
}

async function abertosNoBanco(cliente = clienteId) {
  const lembretes = await prisma.reminder.findMany({
    where: { clientId: cliente, concluidoEm: null },
    orderBy: [{ data: 'asc' }, { criadoEm: 'asc' }],
  });
  return lembretes.map((lembrete) => ({ texto: lembrete.texto, data: lembrete.data.toISOString().slice(0, 10) }));
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 4);
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });
  eduardaId = (await prisma.user.create({ data: { ...EDUARDA, senhaHash } })).id;
  rafaelId = (await prisma.user.create({ data: { ...RAFAEL, senhaHash } })).id;

  tokenGestor = await logar(GESTOR.email);
  tokenEduarda = await logar(EDUARDA.email);
  tokenRafael = await logar(RAFAEL.email);

  clienteId = await criarCliente(eduardaId, 'Emporio Pomerode');
  clienteDoRafaelId = await criarCliente(rafaelId, 'Cafe Blumenau');
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('POST /clients/:id/visits com lembrete', () => {
  it('check-in com lembrete {texto, data} cria o lembrete aberto ligado à visita', async () => {
    const res = await checkIn({ lembrete: { texto: '  Levar amostras de Natal  ', data: daquiA(5) } });

    expect(res.status).toBe(201);
    const lembretes = await prisma.reminder.findMany({ where: { clientId: clienteId } });
    expect(lembretes).toHaveLength(1);
    expect(lembretes[0]).toMatchObject({
      texto: 'Levar amostras de Natal',
      data: new Date(`${daquiA(5)}T00:00:00.000Z`),
      visitId: res.body.id,
      criadoPorId: eduardaId,
      concluidoEm: null,
    });
    // O lembrete não depende da próxima visita: o cliente segue sem data marcada
    expect((await prisma.client.findUniqueOrThrow({ where: { id: clienteId } })).proximaVisita).toBeNull();
  });

  it('aceita lembrete para hoje', async () => {
    const res = await checkIn({ lembrete: { texto: 'Ligar para a compradora', data: daquiA(0) } });

    expect(res.status).toBe(201);
    expect(await abertosNoBanco()).toEqual([{ texto: 'Ligar para a compradora', data: daquiA(0) }]);
  });

  it('check-in com lembrete sem data → 400 "Informe a data do lembrete."; data de ontem → 400', async () => {
    const semData = await checkIn({ lembrete: { texto: 'Levar amostras' } });

    expect(semData.status).toBe(400);
    expect(semData.body.error.code).toBe('VALIDATION_ERROR');
    expect(mensagensDoErro(semData)).toContain('Informe a data do lembrete.');

    const ontem = await checkIn({ lembrete: { texto: 'Levar amostras', data: daquiA(-1) } });

    expect(ontem.status).toBe(400);
    expect(mensagensDoErro(ontem)).toContain('A data do lembrete não pode ser antes de hoje.');

    // Nada gravado: nem a visita nem o lembrete
    expect(await prisma.visit.count()).toBe(0);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it.each([
    ['texto em branco', { texto: '   ', data: '2099-01-01' }, 'Informe o texto do lembrete.'],
    ['sem texto', { data: '2099-01-01' }, 'Informe o texto do lembrete.'],
    ['texto com mais de 200 caracteres', { texto: 'a'.repeat(201), data: '2099-01-01' }, 'O lembrete pode ter no máximo 200 caracteres.'],
    ['data no formato brasileiro', { texto: 'Levar amostras', data: '20/10/2099' }, 'Data do lembrete inválida.'],
    ['data que não existe', { texto: 'Levar amostras', data: '2099-02-30' }, 'Data do lembrete inválida.'],
  ])('recusa lembrete com %s', async (_rotulo, lembrete, mensagem) => {
    const res = await checkIn({ lembrete });

    expect(res.status).toBe(400);
    expect(mensagensDoErro(res)).toContain(mensagem);
    expect(await prisma.visit.count()).toBe(0);
  });

  it('lembrete null (front da versão anterior, ainda em cache) → 201 sem lembrete', async () => {
    const res = await checkIn({ proximaVisita: daquiA(7), lembrete: null });

    expect(res.status).toBe(201);
    expect(await prisma.visit.count()).toBe(1);
    expect(await prisma.reminder.count()).toBe(0);
  });

  it('lembrete como texto solto (formato antigo) → 400 "Atualize o app para registrar o lembrete."', async () => {
    const res = await checkIn({ lembrete: 'Levar amostras' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mensagensDoErro(res)).toEqual(['Atualize o app para registrar o lembrete.']);
    expect(await prisma.visit.count()).toBe(0);
  });

  it('recusa lembrete com campo a mais', async () => {
    const res = await checkIn({ lembrete: { texto: 'Levar amostras', data: '2099-01-01', concluidoEm: '2099-01-01' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.visit.count()).toBe(0);
  });

  it('check-in novo sem lembrete não conclui o aberto; com lembrete novo, ficam dois abertos', async () => {
    await checkIn({ lembrete: { texto: 'Levar amostras de Natal', data: daquiA(5) } });

    const semLembrete = await checkIn();
    expect(semLembrete.status).toBe(201);
    expect(await abertosNoBanco()).toEqual([{ texto: 'Levar amostras de Natal', data: daquiA(5) }]);

    const comLembrete = await checkIn({ lembrete: { texto: 'Cobrar o pedido de Páscoa', data: daquiA(2) } });
    expect(comLembrete.status).toBe(201);
    expect(await abertosNoBanco()).toEqual([
      { texto: 'Cobrar o pedido de Páscoa', data: daquiA(2) },
      { texto: 'Levar amostras de Natal', data: daquiA(5) },
    ]);
  });

  it('apagar a próxima visita no check-in não apaga lembretes', async () => {
    await checkIn({ proximaVisita: daquiA(10), lembrete: { texto: 'Levar amostras de Natal', data: daquiA(10) } });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: clienteId } })).proximaVisita).not.toBeNull();

    const res = await checkIn({ proximaVisita: null });

    expect(res.status).toBe(201);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: clienteId } })).proximaVisita).toBeNull();
    expect(await abertosNoBanco()).toEqual([{ texto: 'Levar amostras de Natal', data: daquiA(10) }]);
  });

  it('pedido recusado não cria o lembrete (mesma transação da visita)', async () => {
    const res = await checkIn({
      resultado: 'SEM_VENDA',
      itens: [{ sku: 'BOMB-SORT', quantidade: 2 }],
      lembrete: { texto: 'Levar amostras', data: daquiA(3) },
    });

    expect(res.status).toBe(400);
    expect(await prisma.reminder.count()).toBe(0);
  });
});

describe('GET /clients/:id/lembretes', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get(`/clients/${clienteId}/lembretes`);

    expect(res.status).toBe(401);
  });

  it('GET /clients/:id/lembretes lista só os abertos, por data; cliente de outra carteira → 404', async () => {
    const adiante = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Levar amostras', data: daquiA(4) });
    const vencido = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Cobrar boleto', data: daquiA(-3) });
    const deHoje = await criarLembrete({ clientId: clienteId, criadoPorId: rafaelId, texto: 'Ligar para a sócia', data: daquiA(0) });
    await criarLembrete({
      clientId: clienteId,
      criadoPorId: eduardaId,
      texto: 'Já resolvido',
      data: daquiA(-1),
      concluidoEm: new Date(),
    });
    await criarLembrete({ clientId: clienteDoRafaelId, criadoPorId: rafaelId, texto: 'De outro cliente', data: daquiA(1) });

    const res = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenEduarda);

    expect(res.status).toBe(200);
    const comum = {
      clienteId,
      nomeFantasia: 'Emporio Pomerode',
      cidade: 'Pomerode',
      representante: { id: eduardaId, nome: EDUARDA.nome },
    };
    expect(res.body).toEqual({
      data: [
        { ...comum, id: vencido, texto: 'Cobrar boleto', data: daquiA(-3), diasAtraso: 3 },
        { ...comum, id: deHoje, texto: 'Ligar para a sócia', data: daquiA(0), diasAtraso: 0 },
        { ...comum, id: adiante, texto: 'Levar amostras', data: daquiA(4), diasAtraso: -4 },
      ],
    });

    // O gestor também lê
    const doGestor = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenGestor);
    expect(doGestor.status).toBe(200);
    expect(doGestor.body.data).toHaveLength(3);

    // Cliente de outra carteira responde ao representante como inexistente
    const deOutraCarteira = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenRafael);
    expect(deOutraCarteira.status).toBe(404);
    expect(deOutraCarteira.body.error.message).toBe('Cliente não encontrado.');
  });

  it('cliente inativado: o lembrete sai da agenda do dia e do calendário, mas continua na ficha', async () => {
    const doInativo = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Levar amostras', data: daquiA(0) });
    const doAtivo = await criarLembrete({
      clientId: clienteDoRafaelId,
      criadoPorId: rafaelId,
      texto: 'Cobrar boleto',
      data: daquiA(0),
    });
    await prisma.client.update({ where: { id: clienteId }, data: { ativo: false } });

    const agenda = await autenticado(request(app).get('/agenda/today'), tokenGestor);
    expect(agenda.status).toBe(200);
    expect(agenda.body.data.lembretes.map((lembrete: { id: string }) => lembrete.id)).toEqual([doAtivo]);

    const calendario = await autenticado(request(app).get('/agenda/calendario').query({ mes: daquiA(0).slice(0, 7) }), tokenGestor);
    expect(calendario.status).toBe(200);
    const idsNoCalendario = calendario.body.data.itens
      .filter((item: { tipo: string }) => item.tipo === 'LEMBRETE')
      .map((item: { lembreteId: string }) => item.lembreteId);
    expect(idsNoCalendario).toEqual([doAtivo]);

    const ficha = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenEduarda);
    expect(ficha.status).toBe(200);
    expect(ficha.body.data.map((lembrete: { id: string }) => lembrete.id)).toEqual([doInativo]);
  });

  it('cliente inexistente → 404; sem lembretes → lista vazia', async () => {
    const inexistente = await autenticado(request(app).get(`/clients/${ID_INEXISTENTE}/lembretes`), tokenGestor);
    expect(inexistente.status).toBe(404);

    const vazio = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenEduarda);
    expect(vazio.status).toBe(200);
    expect(vazio.body).toEqual({ data: [] });
  });
});

describe('PATCH /lembretes/:id/concluir', () => {
  function concluir(id: string, token: string) {
    return autenticado(request(app).patch(`/lembretes/${id}/concluir`), token);
  }

  it('sem token responde 401', async () => {
    const id = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Levar amostras', data: daquiA(1) });

    const res = await request(app).patch(`/lembretes/${id}/concluir`);

    expect(res.status).toBe(401);
  });

  it('PATCH /lembretes/:id/concluir pelo dono → 200 com concluidoEm; pelo gestor → 200; repetido → 409', async () => {
    const doDono = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Levar amostras', data: daquiA(1) });
    const doGestor = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Cobrar boleto', data: daquiA(-2) });

    const antes = Date.now();
    const peloDono = await concluir(doDono, tokenEduarda);

    expect(peloDono.status).toBe(200);
    expect(peloDono.body).toEqual({ id: doDono, concluidoEm: expect.any(String) });
    const concluidoEm = new Date(peloDono.body.concluidoEm).getTime();
    expect(concluidoEm).toBeGreaterThanOrEqual(antes - 1000);
    expect(concluidoEm).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: doDono } })).concluidoEm?.toISOString()).toBe(
      peloDono.body.concluidoEm,
    );

    const peloGestor = await concluir(doGestor, tokenGestor);
    expect(peloGestor.status).toBe(200);
    expect(peloGestor.body.id).toBe(doGestor);

    // Concluídos saem da lista
    const lista = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenEduarda);
    expect(lista.body).toEqual({ data: [] });

    const repetido = await concluir(doDono, tokenEduarda);
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toEqual({ code: 'CONFLICT', message: 'Lembrete já concluído.' });
    // A data da conclusão não muda
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: doDono } })).concluidoEm?.toISOString()).toBe(
      peloDono.body.concluidoEm,
    );
  });

  it('lembrete inexistente ou de outra carteira → 404 "Lembrete não encontrado."', async () => {
    const id = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Levar amostras', data: daquiA(1) });

    const deOutraCarteira = await concluir(id, tokenRafael);
    expect(deOutraCarteira.status).toBe(404);
    expect(deOutraCarteira.body.error).toEqual({ code: 'NOT_FOUND', message: 'Lembrete não encontrado.' });
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id } })).concluidoEm).toBeNull();

    const inexistente = await concluir(ID_INEXISTENTE, tokenGestor);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.message).toBe('Lembrete não encontrado.');
  });

  it('cliente transferido: o representante antigo recebe 404, o novo conclui', async () => {
    const id = await criarLembrete({ clientId: clienteId, criadoPorId: eduardaId, texto: 'Levar amostras', data: daquiA(1) });
    await prisma.client.update({ where: { id: clienteId }, data: { representanteId: rafaelId } });

    const peloAntigo = await concluir(id, tokenEduarda);
    expect(peloAntigo.status).toBe(404);
    expect(peloAntigo.body.error.message).toBe('Lembrete não encontrado.');

    const peloNovo = await concluir(id, tokenRafael);
    expect(peloNovo.status).toBe(200);
    expect(peloNovo.body.id).toBe(id);

    // A lista do cliente segue o dono atual
    const listaDoAntigo = await autenticado(request(app).get(`/clients/${clienteId}/lembretes`), tokenEduarda);
    expect(listaDoAntigo.status).toBe(404);
  });
});
