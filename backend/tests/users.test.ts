import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const GESTOR = {
  nome: 'Maicon Krüger',
  email: 'maicon.users-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

const REPRESENTANTE_B = {
  nome: 'Rafael Schmitt',
  email: 'rafael.users-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_A = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.users-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

let tokenGestor: string;
let tokenRepresentante: string;

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  // Criados fora da ordem alfabética para provar a ordenação por nome.
  await prisma.user.create({ data: { ...REPRESENTANTE_B, senhaHash } });
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });
  await prisma.user.create({ data: { ...REPRESENTANTE_A, senhaHash } });

  tokenGestor = await logar(GESTOR.email);
  tokenRepresentante = await logar(REPRESENTANTE_A.email);
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /users', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/users?role=REPRESENTANTE');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('representante responde 403', async () => {
    const res = await request(app)
      .get('/users?role=REPRESENTANTE')
      .set('Authorization', `Bearer ${tokenRepresentante}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('gestor recebe só os representantes (id e nome), ordenados por nome', async () => {
    const res = await request(app)
      .get('/users?role=REPRESENTANTE')
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { id: expect.any(String), nome: 'Eduarda Fischer' },
      { id: expect.any(String), nome: 'Rafael Schmitt' },
    ]);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'nome']);
  });

  it('sem role responde 400', async () => {
    const res = await request(app).get('/users').set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('role=GESTOR responde 400', async () => {
    const res = await request(app)
      .get('/users?role=GESTOR')
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
