import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  usuario: 'eduarda.stock-message-teste',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  usuario: 'ricardo.stock-message-teste',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let representanteId: string;

let clienteAtivoId: string;
let clienteAtivoTelefone: string;
let contactPrincipalId: string;
let contactSecundarioId: string;

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function logar(usuario: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.usuario);
  tokenGestor = await logar(GESTOR.usuario);

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
      chave: 'PASCOA',
      dataInicio: ontem,
      dataFim: amanha,
      produtosSugeridos,
    },
  });
}

/** Cria um segundo representante (sem clientes na carteira) e devolve o token dele. */
async function logarOutroRepresentante(): Promise<string> {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({
    data: {
      nome: 'Outro Representante',
      usuario: 'outro.stock-message-teste',
      role: 'REPRESENTANTE',
      senhaHash,
    },
  });

  return logar('outro.stock-message-teste');
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

  it('cliente de outra carteira 403', async () => {
    const tokenOutro = await logarOutroRepresentante();

    const res = await request(app)
      .get(`/clients/${clienteAtivoId}/stock-message/proposta`)
      .set('Authorization', `Bearer ${tokenOutro}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toBe('Cliente de outra carteira.');
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

    expect(res.body.textosSugeridos).toHaveLength(3);
    const porContato = (id: string | null) =>
      res.body.textosSugeridos.find((item: { contactId: string | null }) => item.contactId === id);
    expect(porContato(contactPrincipalId).texto).toContain('Marta Weber');
    expect(porContato(contactSecundarioId).texto).toContain('João Neto');
    expect(porContato(null).texto).toContain('Olá, cliente!');
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

describe('rotas de registro de mensagem removidas', () => {
  it('POST /clients/:id/stock-message responde 404', async () => {
    const res = await request(app)
      .post(`/clients/${clienteAtivoId}/stock-message`)
      .set('Authorization', `Bearer ${token}`)
      .send({ texto: 'Olá, como está o estoque de chocolates?', contactId: contactPrincipalId });

    expect(res.status).toBe(404);
  });

  it('GET /stock-messages responde 404', async () => {
    const res = await request(app).get('/stock-messages').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(404);
  });
});
