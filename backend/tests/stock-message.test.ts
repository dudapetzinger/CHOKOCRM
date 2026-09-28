import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { normalizarTelefone } from '../src/services/stock-message.template';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.stock-message-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.stock-message-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let representanteId: string;

let clienteAtivoId: string;
let clienteAtivoTelefone: string;
let contactPrincipalId: string;
let contactSecundarioId: string;

let clienteInativoId: string;

let clienteOutroId: string;
let contactDeOutroClienteId: string;

let clienteTelefoneInvalidoId: string;
let contactTelefoneInvalidoId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  clienteAtivoTelefone = '(47) 3395-0000';
  const clienteAtivo = await prisma.client.create({
    data: {
      razaoSocial: 'Emporio Pomerode Comércio Ltda',
      nomeFantasia: 'Emporio Pomerode',
      cnpj: '11222333000181',
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: clienteAtivoTelefone,
      email: `contato@${apelido('Emporio Pomerode')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      ativo: true,
      contacts: {
        create: [
          {
            nome: 'Marta Weber',
            cargo: 'Compradora',
            telefone: '(47) 99911-2233',
            email: 'marta@emporiopomerode.com.br',
            principal: true,
          },
          {
            nome: 'João Neto',
            cargo: 'Estoquista',
            telefone: '(47) 99922-3344',
            email: 'joao@emporiopomerode.com.br',
            principal: false,
          },
        ],
      },
    },
    include: { contacts: true },
  });
  clienteAtivoId = clienteAtivo.id;
  contactPrincipalId = clienteAtivo.contacts.find((c) => c.principal)!.id;
  contactSecundarioId = clienteAtivo.contacts.find((c) => !c.principal)!.id;

  const clienteInativo = await prisma.client.create({
    data: {
      razaoSocial: 'Cafe Blumenau Comércio Ltda',
      nomeFantasia: 'Cafe Blumenau',
      cnpj: '11222333000262',
      cidade: 'Blumenau',
      endereco: 'Rua XV de Novembro, 200',
      telefone: '(47) 3322-0000',
      email: `contato@${apelido('Cafe Blumenau')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      ativo: false,
    },
  });
  clienteInativoId = clienteInativo.id;

  const clienteOutro = await prisma.client.create({
    data: {
      razaoSocial: 'Doceria Jaragua Comércio Ltda',
      nomeFantasia: 'Doceria Jaragua',
      cnpj: '11222333000343',
      cidade: 'Jaraguá do Sul',
      endereco: 'Rua Walter Marquardt, 300',
      telefone: '(47) 3376-0000',
      email: `contato@${apelido('Doceria Jaragua')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      ativo: true,
      contacts: {
        create: [
          {
            nome: 'Contato de Outro Cliente',
            cargo: 'Gerente',
            telefone: '(47) 99933-4455',
            email: 'contato@docericajaragua.com.br',
            principal: true,
          },
        ],
      },
    },
    include: { contacts: true },
  });
  clienteOutroId = clienteOutro.id;
  contactDeOutroClienteId = clienteOutro.contacts[0]!.id;

  const clienteTelefoneInvalido = await prisma.client.create({
    data: {
      razaoSocial: 'Chocolates Timbo Comércio Ltda',
      nomeFantasia: 'Chocolates Timbo',
      cnpj: '11222333000424',
      cidade: 'Timbó',
      endereco: 'Rua 7 de Setembro, 400',
      telefone: '(47) 3382-0000',
      email: `contato@${apelido('Chocolates Timbo')}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      ativo: true,
      contacts: {
        create: [
          {
            nome: 'Contato Telefone Inválido',
            cargo: 'Compras',
            telefone: '1234',
            email: 'contato@chocolatestimbo.com.br',
            principal: true,
          },
        ],
      },
    },
    include: { contacts: true },
  });
  clienteTelefoneInvalidoId = clienteTelefoneInvalido.id;
  contactTelefoneInvalidoId = clienteTelefoneInvalido.contacts[0]!.id;
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

async function criarEventoVigenteHoje(nome = 'Evento Teste', produtosSugeridos = ['trufas']) {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  ontem.setUTCHours(12, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);
  amanha.setUTCHours(12, 0, 0, 0);

  return prisma.seasonalEvent.create({
    data: {
      nome,
      dataInicio: ontem,
      dataFim: amanha,
      produtosSugeridos,
    },
  });
}

describe('GET /clients/:id/stock-message/proposta', () => {
  it('sem token 401', async () => {
    const res = await request(app).get(`/clients/${clienteAtivoId}/stock-message/proposta`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('gestor 403', async () => {
    const res = await request(app)
      .get(`/clients/${clienteAtivoId}/stock-message/proposta`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('cliente inexistente 404', async () => {
    const res = await request(app)
      .get(`/clients/${ID_INEXISTENTE}/stock-message/proposta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('devolve contatos, telefoneCliente, evento null e texto genérico com o nome do contato principal', async () => {
    const res = await request(app)
      .get(`/clients/${clienteAtivoId}/stock-message/proposta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.evento).toBeNull();
    expect(res.body.telefoneCliente).toBe(clienteAtivoTelefone);
    expect(res.body.contatos).toHaveLength(2);
    expect(res.body.contatos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: contactPrincipalId, nome: 'Marta Weber', principal: true }),
        expect.objectContaining({ id: contactSecundarioId, nome: 'João Neto', principal: false }),
      ]),
    );
    expect(res.body.textoSugerido).toContain('Marta Weber');
    expect(res.body.textoSugerido).toContain('estoque de chocolates');
  });

  it('com evento vigente devolve o evento e o texto sazonal', async () => {
    const evento = await criarEventoVigenteHoje('Evento Teste', ['trufas']);

    const res = await request(app)
      .get(`/clients/${clienteAtivoId}/stock-message/proposta`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.evento).toEqual({ id: evento.id, nome: 'Evento Teste', produtosSugeridos: ['trufas'] });
    expect(res.body.textoSugerido).toContain('Evento Teste');
    expect(res.body.textoSugerido).toContain('trufas');
  });
});

describe('POST /clients/:id/stock-message', () => {
  it('gestor 403', async () => {
    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('cliente inativo 409', async () => {
    const res = await request(app)
      .post(`/clients/${clienteInativoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe('Cliente inativo não recebe mensagem de estoque.');
  });

  it('contato de outro cliente 400', async () => {
    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?', contactId: contactDeOutroClienteId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Contato informado não pertence a este cliente.');
  });

  it('texto curto 400', async () => {
    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'curto' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('contato com telefone inválido 400 e nada gravado', async () => {
    const res = await request(app)
      .post(`/clients/${clienteTelefoneInvalidoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?', contactId: contactTelefoneInvalidoId });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Telefone inválido para gerar o link do WhatsApp.');

    const total = await prisma.stockMessage.count();
    expect(total).toBe(0);
  });

  it('201 sem evento: grava StockMessage com eventoSazonalId null e devolve link do contato principal', async () => {
    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?', contactId: contactPrincipalId });

    expect(res.status).toBe(201);
    expect(res.body.evento).toBeNull();
    expect(res.body.link).toMatch(/^https:\/\/wa\.me\/5547999112233\?text=/);

    const registro = await prisma.stockMessage.findUnique({ where: { id: res.body.id } });
    expect(registro?.eventoSazonalId).toBeNull();
  });

  it('201 com evento vigente grava eventoSazonalId', async () => {
    const evento = await criarEventoVigenteHoje();

    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?', contactId: contactPrincipalId });

    expect(res.status).toBe(201);
    expect(res.body.evento).toEqual({ id: evento.id, nome: evento.nome });

    const registro = await prisma.stockMessage.findUnique({ where: { id: res.body.id } });
    expect(registro?.eventoSazonalId).toBe(evento.id);
  });

  it('sem contactId usa o telefone do cliente', async () => {
    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?' });

    expect(res.status).toBe(201);
    expect(res.body.contato).toBeNull();

    const telefoneNormalizado = normalizarTelefone(clienteAtivoTelefone);
    expect(res.body.link).toMatch(new RegExp(`^https://wa\\.me/${telefoneNormalizado}\\?text=`));
  });

  it('preserva quebras de linha, acentos e emoji no textoFinal e no link', async () => {
    const texto = 'Olá, cliente!\nComo está o estoque de açúcar e panetões? 🍫';

    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto, contactId: contactPrincipalId });

    expect(res.status).toBe(201);
    expect(res.body.textoFinal).toBe(texto);

    const [, textoCodificado] = res.body.link.split('?text=');
    expect(decodeURIComponent(textoCodificado)).toBe(texto);
  });
});

describe('GET /stock-messages', () => {
  it('sem token 401', async () => {
    const res = await request(app).get('/stock-messages');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('gestor lista todas, mais recente primeiro', async () => {
    const mensagemAntiga = await prisma.stockMessage.create({
      data: {
        clientId: clienteAtivoId,
        userId: representanteId,
        textoFinal: 'Mensagem mais antiga',
        dataGeracao: new Date('2026-01-01T12:00:00Z'),
      },
    });
    const mensagemRecente = await prisma.stockMessage.create({
      data: {
        clientId: clienteOutroId,
        userId: representanteId,
        textoFinal: 'Mensagem mais recente',
        dataGeracao: new Date('2026-02-01T12:00:00Z'),
      },
    });

    const res = await request(app).get('/stock-messages').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(mensagemRecente.id);
    expect(res.body.data[1].id).toBe(mensagemAntiga.id);
  });

  it('?clientId filtra', async () => {
    await prisma.stockMessage.create({
      data: {
        clientId: clienteAtivoId,
        userId: representanteId,
        textoFinal: 'Mensagem do cliente ativo',
        dataGeracao: new Date('2026-01-01T12:00:00Z'),
      },
    });
    await prisma.stockMessage.create({
      data: {
        clientId: clienteOutroId,
        userId: representanteId,
        textoFinal: 'Mensagem do outro cliente',
        dataGeracao: new Date('2026-01-02T12:00:00Z'),
      },
    });

    const res = await request(app)
      .get(`/stock-messages?clientId=${clienteAtivoId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].cliente.id).toBe(clienteAtivoId);
  });

  it('?clientId inválido 400', async () => {
    const res = await request(app)
      .get('/stock-messages?clientId=nao-eh-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
