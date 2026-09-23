import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

/** JPEG mínimo válido: assinatura FF D8 FF seguida de bytes quaisquer. */
const JPEG_VALIDO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
/** Bytes que não correspondem a nenhuma assinatura de imagem. */
const NAO_E_IMAGEM = Buffer.from('isto aqui é um texto, não uma foto', 'utf8');
/** Acima do limite de 5 MB do parser de imagem. */
const JPEG_GRANDE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(6 * 1024 * 1024, 7)]);

let token: string;
let tokenOutro: string;
let clienteId: string;
let visitaId: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  await prisma.user.create({
    data: {
      nome: 'Eduarda Fischer',
      email: 'eduarda.foto-teste@chokolaten.com.br',
      role: 'REPRESENTANTE',
      senhaHash,
    },
  });
  await prisma.user.create({
    data: {
      nome: 'Outro Representante',
      email: 'outro.foto-teste@chokolaten.com.br',
      role: 'REPRESENTANTE',
      senhaHash,
    },
  });

  token = await logar('eduarda.foto-teste@chokolaten.com.br');
  tokenOutro = await logar('outro.foto-teste@chokolaten.com.br');

  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Empório Pomerode Comércio Ltda',
      nomeFantasia: 'Empório Pomerode',
      cnpj: '11222333000181',
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 620',
      telefone: '(47) 3395-1122',
      email: 'contato@emporiopomerode.com.br',
      contacts: {
        create: [
          {
            nome: 'Marta Weber',
            cargo: 'Compradora',
            telefone: '(47) 99911-2233',
            email: 'marta@emporiopomerode.com.br',
            principal: true,
          },
        ],
      },
    },
  });
  clienteId = cliente.id;

  const criada = await request(app)
    .post(`/clients/${clienteId}/visits`)
    .set('Authorization', `Bearer ${token}`)
    .send({ descricao: 'Reposição do mostruário.', resultado: 'VENDA' });
  visitaId = criada.body.id;
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

function anexarFoto(id: string, autorizacao: string, conteudo: Buffer, contentType = 'image/jpeg') {
  return request(app)
    .put(`/visits/${id}/foto`)
    .set('Authorization', `Bearer ${autorizacao}`)
    .set('Content-Type', contentType)
    .send(conteudo);
}

describe('PUT /visits/:id/foto', () => {
  it('anexa a foto e passa a indicar temFoto', async () => {
    const res = await anexarFoto(visitaId, token, JPEG_VALIDO);

    expect(res.status).toBe(200);
    expect(res.body.temFoto).toBe(true);
  });

  it('devolve os mesmos bytes no GET', async () => {
    await anexarFoto(visitaId, token, JPEG_VALIDO);

    const res = await request(app)
      .get(`/visits/${visitaId}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((resposta, callback) => {
        const partes: Buffer[] = [];
        resposta.on('data', (parte: Buffer) => partes.push(parte));
        resposta.on('end', () => callback(null, Buffer.concat(partes)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect((res.body as Buffer).equals(JPEG_VALIDO)).toBe(true);
  });

  it('recusa Content-Type que não é de imagem aceita', async () => {
    const res = await anexarFoto(visitaId, token, JPEG_VALIDO, 'application/pdf');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('recusa corpo vazio mesmo com Content-Type de imagem', async () => {
    const res = await anexarFoto(visitaId, token, Buffer.alloc(0));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    const visita = await prisma.visit.findUniqueOrThrow({ where: { id: visitaId } });
    expect(visita.fotoPath).toBeNull();
  });

  it('recusa bytes que não são de imagem', async () => {
    const res = await anexarFoto(visitaId, token, NAO_E_IMAGEM);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('recusa foto acima de 5 MB', async () => {
    const res = await anexarFoto(visitaId, token, JPEG_GRANDE);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('recusa a segunda foto na mesma visita', async () => {
    await anexarFoto(visitaId, token, JPEG_VALIDO);

    const res = await anexarFoto(visitaId, token, JPEG_VALIDO);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('recusa anexo por quem não é o autor', async () => {
    const res = await anexarFoto(visitaId, tokenOutro, JPEG_VALIDO);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('responde 404 para visita inexistente', async () => {
    const res = await anexarFoto(ID_INEXISTENTE, token, JPEG_VALIDO);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /visits/:id/foto', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get(`/visits/${visitaId}/foto`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('responde 404 quando a visita não tem foto', async () => {
    const res = await request(app).get(`/visits/${visitaId}/foto`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('responde 404 legível quando o arquivo desapareceu do disco', async () => {
    await anexarFoto(visitaId, token, JPEG_VALIDO);

    // Simula volume novo / restauração só do banco: o registro aponta para
    // uma foto que não está mais no armazenamento.
    await rm(path.resolve(__dirname, '..', 'uploads', 'visits', `${visitaId}.jpg`), { force: true });

    const res = await request(app).get(`/visits/${visitaId}/foto`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
