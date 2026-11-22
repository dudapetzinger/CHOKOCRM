import { api } from './api';
import { buscarSazonalidade } from './insights';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  api: { get: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ datas: [] });
});

describe('buscarSazonalidade', () => {
  it('manda o horizonte e, quando há, o representante', async () => {
    await buscarSazonalidade(90);
    await buscarSazonalidade(180, 'u1');

    expect(api.get).toHaveBeenNthCalledWith(1, '/insights/sazonalidade?horizonteDias=90');
    expect(api.get).toHaveBeenNthCalledWith(2, '/insights/sazonalidade?horizonteDias=180&representanteId=u1');
  });
});
