import { api } from './api';
import { buscarRelogio, definirDemonstracao } from './sistema';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  api: { get: vi.fn(), postSemSessao: vi.fn() },
}));

const RELOGIO = {
  agora: '2027-03-15T15:00:00.000Z',
  simulado: true,
  dataDeDemonstracao: '2027-03-15',
  diaDeReferencia: '2026-11-09',
  deslocamentoDias: 126,
};

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue(RELOGIO);
  vi.mocked(api.postSemSessao).mockReset().mockResolvedValue({ relogio: RELOGIO });
});

describe('serviços de sistema', () => {
  it('buscarRelogio lê GET /sistema/relogio', async () => {
    await expect(buscarRelogio()).resolves.toEqual(RELOGIO);

    expect(api.get).toHaveBeenCalledWith('/sistema/relogio');
  });

  it('definirDemonstracao manda a data, o e-mail e a senha para POST /sistema/demonstracao, sem o token da sessão', async () => {
    const resposta = await definirDemonstracao({
      data: '2027-03-15',
      email: 'gestao@chokolaten.com.br',
      senha: 'segredo',
    });

    expect(api.postSemSessao).toHaveBeenCalledWith('/sistema/demonstracao', {
      data: '2027-03-15',
      email: 'gestao@chokolaten.com.br',
      senha: 'segredo',
    });
    expect(resposta).toEqual({ relogio: RELOGIO });
  });

  it('definirDemonstracao com data null desliga o modo demonstração', async () => {
    await definirDemonstracao({ data: null, email: 'gestao@chokolaten.com.br', senha: 'segredo' });

    expect(api.postSemSessao).toHaveBeenCalledWith('/sistema/demonstracao', {
      data: null,
      email: 'gestao@chokolaten.com.br',
      senha: 'segredo',
    });
  });
});
