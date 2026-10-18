import bcrypt from 'bcryptjs';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { errorHandler } from '../src/middlewares/errorHandler';
import { authJwt } from '../src/middlewares/authJwt';
import { requireRole } from '../src/middlewares/requireRole';
import { prisma } from '../src/lib/prisma';
import { emailProvider } from '../src/providers/email';
import { ConsoleEmailProvider } from '../src/providers/email/ConsoleEmailProvider';
import { consumirTokenERedefinirSenha } from '../src/repositories/user.repository';
import { hashDoToken } from '../src/services/redefinicao-senha.regras';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.teste@chokolaten.com.br',
  telefone: '(47) 99911-2233',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'gestor.teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

/**
 * App isolado, montado apenas para este arquivo de teste, usado para
 * exercitar `requireRole` sem depender de uma rota real de produção
 * (que ainda não existe nesta task — o único endpoint protegido "real"
 * hoje é GET /auth/me, sem exigência de papel específico).
 */
function buildRotaDeTesteComRole(): Express {
  const testApp = express();
  testApp.get('/rota-gestor', authJwt, requireRole('GESTOR'), (req, res) => {
    res.status(200).json({ ok: true, user: req.user });
  });
  testApp.use(errorHandler);
  return testApp;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  await prisma.user.create({
    data: { ...REPRESENTANTE, senhaHash },
  });
  await prisma.user.create({
    data: { ...GESTOR, senhaHash },
  });
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('login com credenciais corretas devolve token decodificável e usuário sem senhaHash', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      nome: REPRESENTANTE.nome,
      email: REPRESENTANTE.email,
      telefone: '(47) 99911-2233',
      role: REPRESENTANTE.role,
      ativo: true,
    });
    expect(res.body.user.senhaHash).toBeUndefined();

    const decodificado = jwt.verify(res.body.token, env.JWT_SECRET);
    expect(decodificado).toMatchObject({ sub: res.body.user.id, role: REPRESENTANTE.role });
  });

  it('senha errada responde 401 com mensagem genérica', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
  });

  it('e-mail inexistente responde 401 com a mesma mensagem genérica', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ninguem@chokolaten.com.br', senha: SENHA_PADRAO });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
  });

  it('e-mail com maiúsculas entra (e-mails são comparados em minúsculas)', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'Eduarda.Teste@Chokolaten.com.br', senha: SENHA_PADRAO });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(REPRESENTANTE.email);
  });

  it('conta inativa com a senha certa responde 403 "Conta inativa. Fale com o gestor."', async () => {
    await prisma.user.update({ where: { email: REPRESENTANTE.email }, data: { ativo: false } });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toBe('Conta inativa. Fale com o gestor.');
    expect(res.body.token).toBeUndefined();
  });

  it('conta inativa com a senha errada responde o 401 genérico (não revela a inativação)', async () => {
    await prisma.user.update({ where: { email: REPRESENTANTE.email }, data: { ativo: false } });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: 'senha-errada' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('E-mail ou senha inválidos');
  });

  it('body sem email responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/auth/login').send({ senha: SENHA_PADRAO });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me (exemplo de rota protegida por authJwt)', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('com token inválido responde 401', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer token-invalido');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('com token válido responde 200 com o usuário lido do banco (com ativo e telefone)', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: login.body.user.id,
      nome: REPRESENTANTE.nome,
      email: REPRESENTANTE.email,
      telefone: REPRESENTANTE.telefone,
      role: REPRESENTANTE.role,
      ativo: true,
    });
  });

  it('reflete o que mudou no banco depois do login', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
    await prisma.user.update({ where: { id: login.body.user.id }, data: { nome: 'Eduarda F.', telefone: null } });

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nome: 'Eduarda F.', telefone: null });
  });
});

describe("requireRole('GESTOR') em rota protegida de teste", () => {
  it('usuário com papel diferente do exigido responde 403', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

    const testApp = buildRotaDeTesteComRole();
    const res = await request(testApp)
      .get('/rota-gestor')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('usuário com o papel exigido responde 200', async () => {
    const login = await request(app).post('/auth/login').send({ email: GESTOR.email, senha: SENHA_PADRAO });

    const testApp = buildRotaDeTesteComRole();
    const res = await request(testApp)
      .get('/rota-gestor')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: login.body.user.id, role: GESTOR.role });
  });
});

describe('PUT /auth/password', () => {
  async function tokenDaRepresentante(): Promise<string> {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
    return login.body.token;
  }

  it('sem token responde 401', async () => {
    const res = await request(app)
      .put('/auth/password')
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha' });

    expect(res.status).toBe(401);
  });

  // 400, não 401: o front trata todo 401 com token como sessão vencida e
  // desloga; senha atual errada é erro de digitação, não de sessão (R14).
  it('senha atual errada responde 400 "Senha atual incorreta." e nada muda', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${await tokenDaRepresentante()}`)
      .send({ senhaAtual: 'senha-errada', novaSenha: 'nova-senha' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Senha atual incorreta.');

    const login = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
    expect(login.status).toBe(200);
  });

  it('senha nova com menos de 6 caracteres responde 400', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${await tokenDaRepresentante()}`)
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'novaSenha', message: 'A senha deve ter pelo menos 6 caracteres.' },
    ]);
  });

  it('com a senha atual certa responde 204, a nova entra e a antiga não', async () => {
    const res = await request(app)
      .put('/auth/password')
      .set('Authorization', `Bearer ${await tokenDaRepresentante()}`)
      .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'nova-senha' });

    expect(res.status).toBe(204);

    const comNova = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: 'nova-senha' });
    expect(comNova.status).toBe(200);

    const comAntiga = await request(app)
      .post('/auth/login')
      .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });
    expect(comAntiga.status).toBe(401);
  });
});

describe('POST /auth/redefinir-senha', () => {
  const MENSAGEM_LINK_INVALIDO = 'Este link não vale mais. Peça um novo ao gestor.';

  /** O gestor pede a redefinição; o token sai do e-mail guardado pelo ConsoleEmailProvider. */
  async function pedirRedefinicao(): Promise<string> {
    const loginGestor = await request(app).post('/auth/login').send({ email: GESTOR.email, senha: SENHA_PADRAO });
    const representante = await prisma.user.findUniqueOrThrow({ where: { email: REPRESENTANTE.email } });

    const res = await request(app)
      .post(`/users/${representante.id}/redefinicao-de-senha`)
      .set('Authorization', `Bearer ${loginGestor.body.token}`);
    expect(res.status).toBe(204);

    const provedor = emailProvider;
    if (!(provedor instanceof ConsoleEmailProvider)) {
      throw new Error('Os testes esperam o ConsoleEmailProvider.');
    }
    const token = provedor.enviados.at(-1)?.texto.match(/\/redefinir-senha#([A-Za-z0-9_-]+)/)?.[1];
    if (!token) {
      throw new Error('O e-mail de redefinição não trouxe o link.');
    }
    return token;
  }

  async function redefinir(token: string, novaSenha = 'senha-nova'): Promise<request.Response> {
    return request(app).post('/auth/redefinir-senha').send({ token, novaSenha });
  }

  async function entrar(senha: string): Promise<number> {
    const res = await request(app).post('/auth/login').send({ email: REPRESENTANTE.email, senha });
    return res.status;
  }

  it('com o token do e-mail responde 204 (sem login) e a pessoa entra com a senha nova', async () => {
    const token = await pedirRedefinicao();

    const res = await redefinir(token);

    expect(res.status).toBe(204);
    expect(await entrar('senha-nova')).toBe(200);
    expect(await entrar(SENHA_PADRAO)).toBe(401);
  });

  it('o mesmo link não vale duas vezes', async () => {
    const token = await pedirRedefinicao();
    await redefinir(token);

    const res = await redefinir(token, 'outra-senha');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe(MENSAGEM_LINK_INVALIDO);
    expect(await entrar('senha-nova')).toBe(200);
  });

  it('link vencido (24 h + 1 min) responde 400 e a senha não muda', async () => {
    const token = await pedirRedefinicao();
    const venceuHaUmMinuto = new Date(Date.now() - 60_000);
    await prisma.passwordResetToken.updateMany({ data: { expiraEm: venceuHaUmMinuto } });

    const res = await redefinir(token);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(MENSAGEM_LINK_INVALIDO);
    expect(await entrar(SENHA_PADRAO)).toBe(200);
  });

  it('o link anterior a um pedido novo não vale; o novo vale', async () => {
    const anterior = await pedirRedefinicao();
    const novo = await pedirRedefinicao();

    const resAnterior = await redefinir(anterior);
    expect(resAnterior.status).toBe(400);
    expect(resAnterior.body.error.message).toBe(MENSAGEM_LINK_INVALIDO);

    const resNovo = await redefinir(novo);
    expect(resNovo.status).toBe(204);
  });

  it('token desconhecido responde 400 com a mesma mensagem', async () => {
    const res = await redefinir('token-que-nunca-existiu');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(MENSAGEM_LINK_INVALIDO);
  });

  it('link de conta inativada depois do pedido não vale', async () => {
    const token = await pedirRedefinicao();
    await prisma.user.update({ where: { email: REPRESENTANTE.email }, data: { ativo: false } });

    const res = await redefinir(token);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(MENSAGEM_LINK_INVALIDO);
  });

  it('senha nova com menos de 6 caracteres responde 400 e o link continua valendo', async () => {
    const token = await pedirRedefinicao();

    const curta = await redefinir(token, '12345');
    expect(curta.status).toBe(400);
    expect(curta.body.error.details).toEqual([
      { path: 'novaSenha', message: 'A senha deve ter pelo menos 6 caracteres.' },
    ]);

    expect((await redefinir(token)).status).toBe(204);
  });

  describe('links abertos morrem quando a conta muda', () => {
    async function comoGestor(req: request.Test): Promise<request.Response> {
      const login = await request(app).post('/auth/login').send({ email: GESTOR.email, senha: SENHA_PADRAO });
      return req.set('Authorization', `Bearer ${login.body.token}`);
    }

    async function idDaRepresentante(): Promise<string> {
      return (await prisma.user.findUniqueOrThrow({ where: { email: REPRESENTANTE.email } })).id;
    }

    it('inativar a conta mata o link, que não volta a valer na reativação', async () => {
      const token = await pedirRedefinicao();
      const id = await idDaRepresentante();

      expect((await comoGestor(request(app).patch(`/users/${id}`).send({ ativo: false }))).status).toBe(200);
      expect((await comoGestor(request(app).patch(`/users/${id}`).send({ ativo: true }))).status).toBe(200);

      const res = await redefinir(token);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe(MENSAGEM_LINK_INVALIDO);
    });

    it('trocar o e-mail mata o link enviado ao endereço antigo', async () => {
      const token = await pedirRedefinicao();
      const id = await idDaRepresentante();

      const editar = await comoGestor(
        request(app).patch(`/users/${id}`).send({ email: 'eduarda.nova@chokolaten.com.br' }),
      );
      expect(editar.status).toBe(200);

      expect((await redefinir(token)).status).toBe(400);
    });

    it('editar outros dados (nome, telefone) não mata o link', async () => {
      const token = await pedirRedefinicao();
      const id = await idDaRepresentante();

      const editar = await comoGestor(
        request(app).patch(`/users/${id}`).send({ nome: 'Eduarda F.', telefone: '(47) 90000-0000' }),
      );
      expect(editar.status).toBe(200);

      expect((await redefinir(token)).status).toBe(204);
    });

    it('trocar a própria senha mata o link aberto', async () => {
      const token = await pedirRedefinicao();
      const login = await request(app)
        .post('/auth/login')
        .send({ email: REPRESENTANTE.email, senha: SENHA_PADRAO });

      const trocar = await request(app)
        .put('/auth/password')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({ senhaAtual: SENHA_PADRAO, novaSenha: 'trocada1' });
      expect(trocar.status).toBe(204);

      expect((await redefinir(token)).status).toBe(400);
      expect(await entrar('trocada1')).toBe(200);
    });

    it('conta inativada entre a consulta e a gravação: a transação não usa o link nem grava a senha', async () => {
      const token = await pedirRedefinicao();
      const registro = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashDoToken(token) } });
      // Direto no banco, sem passar pela rota: simula a inativação no meio do caminho.
      await prisma.user.update({ where: { id: registro.userId }, data: { ativo: false } });

      const gravou = await consumirTokenERedefinirSenha({
        tokenId: registro.id,
        userId: registro.userId,
        senhaHash: 'hash-que-nao-deve-entrar',
        agora: new Date(),
      });

      expect(gravou).toBe(false);
      const usuario = await prisma.user.findUniqueOrThrow({ where: { id: registro.userId } });
      expect(usuario.senhaHash).not.toBe('hash-que-nao-deve-entrar');
      const depois = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: registro.id } });
      expect(depois.usadoEm).toBeNull();
    });
  });
});
