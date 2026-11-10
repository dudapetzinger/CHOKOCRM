import { semRedeNaApi, registrarRespostaDaApi } from '../pwa/estadoRede';
import { api, ApiError, clearToken, setToken, setUnauthorizedHandler } from './api';
import { mensagemErroApi } from './clients';

afterEach(() => {
  vi.unstubAllGlobals();
  registrarRespostaDaApi();
});

describe('api: falha de rede', () => {
  it('fetch rejeitado (sem internet) vira ApiError NETWORK com a mensagem para o usuário', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const erro = await api.get('/clients').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).code).toBe('NETWORK');
    expect((erro as ApiError).message).toBe('Você está sem internet.');
    expect(mensagemErroApi(erro, 'Não foi possível carregar os clientes.')).toBe('Você está sem internet.');
  });

  it('o mesmo vale para as chamadas binárias (fotos)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const erro = await api.getBlob('/visits/1/photo').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).code).toBe('NETWORK');
  });

  it('a falha de rede acende o aviso de sem internet; a próxima resposta da API apaga', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await api.get('/clients').catch(() => undefined);
    expect(semRedeNaApi()).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
    await api.get('/clients');
    expect(semRedeNaApi()).toBe(false);
  });

  it('erro devolvido pela API continua com o código e a mensagem da API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Cliente não encontrado.' } }), {
          status: 404,
        }),
      ),
    );

    const erro = await api.get('/clients/x').catch((e: unknown) => e);

    expect((erro as ApiError).code).toBe('NOT_FOUND');
    expect((erro as ApiError).message).toBe('Cliente não encontrado.');
    expect(semRedeNaApi()).toBe(false);
  });
});

describe('api: chamada sem sessão (postSemSessao)', () => {
  afterEach(() => {
    clearToken();
    setUnauthorizedHandler(null);
  });

  it('não manda o token salvo e um 401 não encerra a sessão', async () => {
    setToken('token-antigo');
    const aoDeslogar = vi.fn();
    setUnauthorizedHandler(aoDeslogar);
    const buscar = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'E-mail ou senha inválidos' } }), {
        status: 401,
      }),
    );
    vi.stubGlobal('fetch', buscar);

    const erro = await api.postSemSessao('/sistema/demonstracao', { senha: 'x' }).catch((e: unknown) => e);

    expect((erro as ApiError).message).toBe('E-mail ou senha inválidos');
    expect(aoDeslogar).not.toHaveBeenCalled();
    const [, opcoes] = buscar.mock.calls[0] as [string, RequestInit];
    expect(opcoes.headers).not.toHaveProperty('Authorization');
    expect(opcoes.headers).toHaveProperty('Content-Type', 'application/json');
    expect(opcoes.body).toBe(JSON.stringify({ senha: 'x' }));
  });

  it('o post comum, com token salvo, continua encerrando a sessão no 401', async () => {
    setToken('token-antigo');
    const aoDeslogar = vi.fn();
    setUnauthorizedHandler(aoDeslogar);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'x' } }), { status: 401 })),
    );

    await api.post('/clients', {}).catch(() => undefined);

    expect(aoDeslogar).toHaveBeenCalledTimes(1);
  });
});
