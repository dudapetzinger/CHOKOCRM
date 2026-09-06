import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Fernanda Rosa',
  email: 'fernanda.contacts-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

let token: string;

type ClienteFixture = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  contatos: {
    nome: string;
    cargo: string;
    telefone: string;
    email: string;
    principal: boolean;
  }[];
};

const CLIENTE_DUAS_LINHAS: ClienteFixture = {
  razaoSocial: 'Padaria Itoupava Comércio de Alimentos Ltda',
  nomeFantasia: 'Padaria Itoupava',
  cnpj: '22333444000151',
  cidade: 'Blumenau',
  endereco: 'Rua Itoupava, 1200 - Itoupava Central, Blumenau/SC',
  telefone: '(47) 3388-1122',
  email: 'contato@padariaitoupava.com.br',
  contatos: [
    {
      nome: 'Simone Vogt',
      cargo: 'Proprietária',
      telefone: '(47) 99911-1122',
      email: 'simone.vogt@padariaitoupava.com.br',
      principal: true,
    },
    {
      nome: 'Ricardo Lenz',
      cargo: 'Gerente',
      telefone: '(47) 99922-2233',
      email: 'ricardo.lenz@padariaitoupava.com.br',
      principal: false,
    },
  ],
};

const CLIENTE_UM_CONTATO: ClienteFixture = {
  razaoSocial: 'Mercearia Vila Nova Comércio de Alimentos Ltda',
  nomeFantasia: 'Mercearia Vila Nova',
  cnpj: '22333444000232',
  cidade: 'Blumenau',
  endereco: 'Rua Vila Nova, 300 - Vila Nova, Blumenau/SC',
  telefone: '(47) 3377-3344',
  email: 'contato@merceariavilanova.com.br',
  contatos: [
    {
      nome: 'Otávio Klein',
      cargo: 'Proprietário',
      telefone: '(47) 99933-4455',
      email: 'otavio.klein@merceariavilanova.com.br',
      principal: true,
    },
  ],
};

async function idDoClientePorNomeFantasia(nomeFantasia: string): Promise<string> {
  const cliente = await prisma.client.findFirstOrThrow({ where: { nomeFantasia } });
  return cliente.id;
}

async function contatoDoClientePorNome(nome: string): Promise<{ id: string; clientId: string; principal: boolean }> {
  const contato = await prisma.contact.findFirstOrThrow({ where: { nome } });
  return { id: contato.id, clientId: contato.clientId, principal: contato.principal };
}

async function criarClienteFixture(fixture: ClienteFixture): Promise<string> {
  const { contatos, ...dadosCliente } = fixture;
  const client = await prisma.client.create({
    data: { ...dadosCliente, contacts: { create: contatos } },
  });
  return client.id;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });

  const login = await request(app)
    .post('/auth/login')
    .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
  token = login.body.token;

  await criarClienteFixture(CLIENTE_DUAS_LINHAS);
  await criarClienteFixture(CLIENTE_UM_CONTATO);
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

function payloadContatoNovo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    nome: 'Cláudia Petry',
    cargo: 'Compradora',
    telefone: '(47) 99944-5566',
    email: 'claudia.petry@padariaitoupava.com.br',
    principal: false,
    ...overrides,
  };
}

describe('POST /clients/:id/contacts', () => {
  it('sem token responde 401', async () => {
    const id = await idDoClientePorNomeFantasia('Padaria Itoupava');
    const res = await request(app).post(`/clients/${id}/contacts`).send(payloadContatoNovo());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cliente inexistente responde 404', async () => {
    const res = await request(app)
      .post(`/clients/${ID_INEXISTENTE}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadContatoNovo());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('dados inválidos (email ausente) responde 400 VALIDATION_ERROR', async () => {
    const id = await idDoClientePorNomeFantasia('Padaria Itoupava');
    const { email: _email, ...semEmail } = payloadContatoNovo();

    const res = await request(app)
      .post(`/clients/${id}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send(semEmail);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cria contato secundário e responde 201 sem afetar o principal existente', async () => {
    const id = await idDoClientePorNomeFantasia('Padaria Itoupava');

    const res = await request(app)
      .post(`/clients/${id}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadContatoNovo());

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      nome: 'Cláudia Petry',
      cargo: 'Compradora',
      telefone: '(47) 99944-5566',
      email: 'claudia.petry@padariaitoupava.com.br',
      principal: false,
    });

    const principalAtual = await contatoDoClientePorNome('Simone Vogt');
    expect(principalAtual.principal).toBe(true);
  });

  it('cria contato marcado como principal e rebaixa o principal anterior na mesma transação', async () => {
    const id = await idDoClientePorNomeFantasia('Padaria Itoupava');

    const res = await request(app)
      .post(`/clients/${id}/contacts`)
      .set('Authorization', `Bearer ${token}`)
      .send(payloadContatoNovo({ principal: true }));

    expect(res.status).toBe(201);
    expect(res.body.principal).toBe(true);

    const novoPrincipal = await prisma.contact.findUnique({ where: { id: res.body.id } });
    const antigoPrincipal = await contatoDoClientePorNome('Simone Vogt');

    expect(novoPrincipal?.principal).toBe(true);
    expect(antigoPrincipal.principal).toBe(false);
  });
});

describe('PUT /contacts/:id', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).put(`/contacts/${ID_INEXISTENTE}`).send({ nome: 'Novo Nome' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('contato inexistente responde 404', async () => {
    const res = await request(app)
      .put(`/contacts/${ID_INEXISTENTE}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Novo Nome' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('atualiza dados de um contato secundário mantendo principal intocado', async () => {
    const contato = await contatoDoClientePorNome('Ricardo Lenz');

    const res = await request(app)
      .put(`/contacts/${contato.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ telefone: '(47) 90000-0000', cargo: 'Gerente Comercial' });

    expect(res.status).toBe(200);
    expect(res.body.telefone).toBe('(47) 90000-0000');
    expect(res.body.cargo).toBe('Gerente Comercial');
    expect(res.body.principal).toBe(false);
  });

  it('promove contato secundário a principal e rebaixa o anterior na mesma transação', async () => {
    const secundario = await contatoDoClientePorNome('Ricardo Lenz');

    const res = await request(app)
      .put(`/contacts/${secundario.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ principal: true });

    expect(res.status).toBe(200);
    expect(res.body.principal).toBe(true);

    const novoPrincipal = await prisma.contact.findUnique({ where: { id: secundario.id } });
    const antigoPrincipal = await contatoDoClientePorNome('Simone Vogt');

    expect(novoPrincipal?.principal).toBe(true);
    expect(antigoPrincipal.principal).toBe(false);
  });

  it('rebaixar o único contato principal responde 409 CONFLICT PRINCIPAL_OBRIGATORIO', async () => {
    const unico = await contatoDoClientePorNome('Otávio Klein');

    const res = await request(app)
      .put(`/contacts/${unico.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ principal: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRINCIPAL_OBRIGATORIO');

    const inalterado = await prisma.contact.findUnique({ where: { id: unico.id } });
    expect(inalterado?.principal).toBe(true);
  });
});

describe('DELETE /contacts/:id', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).delete(`/contacts/${ID_INEXISTENTE}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('contato inexistente responde 404', async () => {
    const res = await request(app).delete(`/contacts/${ID_INEXISTENTE}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('exclui contato secundário e responde 204', async () => {
    const secundario = await contatoDoClientePorNome('Ricardo Lenz');

    const res = await request(app)
      .delete(`/contacts/${secundario.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const removido = await prisma.contact.findUnique({ where: { id: secundario.id } });
    expect(removido).toBeNull();
  });

  it('excluir o único contato principal responde 409 CONFLICT PRINCIPAL_OBRIGATORIO', async () => {
    const unico = await contatoDoClientePorNome('Otávio Klein');

    const res = await request(app)
      .delete(`/contacts/${unico.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRINCIPAL_OBRIGATORIO');

    const mantido = await prisma.contact.findUnique({ where: { id: unico.id } });
    expect(mantido).not.toBeNull();
  });
});
