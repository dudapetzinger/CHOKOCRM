import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';

/**
 * Frontend servido pela própria API (WEB_DIR, ver `app.ts`). O `app` é
 * carregado depois de fixar WEB_DIR, já que `config/env.ts` lê o
 * `process.env` na importação. Nenhuma rota exercitada aqui consulta o
 * banco (o 401 da agenda sai do authJwt), então não há `$disconnect`.
 */
const INDEX_HTML = '<!doctype html><title>ChokoCRM</title><div id="root"></div>';
const APP_JS = 'console.log("chokocrm");';

const webDirOriginal = process.env.WEB_DIR;
let baseTmp: string;
let webDir: string;
let app: Express;

/** Cria um build mínimo (index.html + assets/app.js) em `dir` e devolve `dir`. */
function criarBuild(dir: string): string {
  mkdirSync(path.join(dir, 'assets'), { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), INDEX_HTML);
  writeFileSync(path.join(dir, 'assets', 'app.js'), APP_JS);
  return dir;
}

async function carregarApp(valorWebDir: string): Promise<Express> {
  process.env.WEB_DIR = valorWebDir;
  let carregado: Express | undefined;
  await jest.isolateModulesAsync(async () => {
    ({ app: carregado } = await import('../src/app'));
  });
  return carregado as Express;
}

beforeAll(async () => {
  baseTmp = mkdtempSync(path.join(tmpdir(), 'chokocrm-web-'));
  webDir = criarBuild(path.join(baseTmp, 'web'));
  app = await carregarApp(webDir);
});

afterAll(() => {
  rmSync(baseTmp, { recursive: true, force: true });
  if (webDirOriginal === undefined) delete process.env.WEB_DIR;
  else process.env.WEB_DIR = webDirOriginal;
});

describe('frontend servido pela API (WEB_DIR)', () => {
  it('GET / responde o index.html sem cache', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).toBe(INDEX_HTML);
  });

  it('arquivos de /assets/ saem com cache imutável', async () => {
    const res = await request(app).get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).toBe(APP_JS);
  });

  it('navegação do browser (Accept text/html) numa rota da SPA recebe o index.html', async () => {
    const res = await request(app)
      .get('/clientes/abc')
      .set('Accept', 'text/html,application/xhtml+xml,*/*;q=0.8');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.text).toBe(INDEX_HTML);
  });

  it('HEAD com Accept text/html também cai no fallback', async () => {
    const res = await request(app).head('/painel').set('Accept', 'text/html');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
  });

  it('/agenda é rota da SPA e da API: a navegação recebe o index.html, a API segue protegida', async () => {
    const navegacao = await request(app).get('/agenda').set('Accept', 'text/html');
    expect(navegacao.status).toBe(200);
    expect(navegacao.text).toBe(INDEX_HTML);

    const api = await request(app).get('/agenda/today').set('Accept', 'text/html');
    expect(api.status).toBe(401);
    expect(api.body.error.code).toBe('UNAUTHORIZED');
  });

  it('requisição sem Accept text/html (fetch) segue para o 404 JSON', async () => {
    const res = await request(app).get('/clientes/abc').set('Accept', '*/*');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('asset inexistente responde 404 JSON', async () => {
    const res = await request(app).get('/assets/nao-existe.js');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('método que não é GET/HEAD não cai no fallback, mesmo com Accept text/html', async () => {
    const res = await request(app).post('/clientes/abc').set('Accept', 'text/html').send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('WEB_DIR sob um diretório iniciado por ponto', () => {
  // Ex.: `.claude/worktrees/...` ou `~/.cache/...`: os segmentos do próprio
  // WEB_DIR não podem contar como dotfiles para o fallback.
  it('GET / e a navegação para uma rota da SPA respondem o index.html', async () => {
    const appOculto = await carregarApp(criarBuild(path.join(baseTmp, '.oculto', 'web')));

    const raiz = await request(appOculto).get('/');
    expect(raiz.status).toBe(200);
    expect(raiz.text).toBe(INDEX_HTML);

    const navegacao = await request(appOculto).get('/clientes/abc').set('Accept', 'text/html');
    expect(navegacao.status).toBe(200);
    expect(navegacao.text).toBe(INDEX_HTML);
  });
});

describe('sem frontend servido', () => {
  it('WEB_DIR vazia: GET / continua 404 JSON', async () => {
    const appSemWeb = await carregarApp('');
    const res = await request(appSemWeb).get('/').set('Accept', 'text/html');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('WEB_DIR inexistente: a API sobe e GET / responde 404 JSON', async () => {
    const appSemWeb = await carregarApp(path.join(webDir, 'nao-existe'));
    const res = await request(appSemWeb).get('/').set('Accept', 'text/html');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
