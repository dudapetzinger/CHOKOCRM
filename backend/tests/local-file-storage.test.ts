import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppError } from '../src/errors/AppError';
import { LocalFileStorage } from '../src/storage/LocalFileStorage';

const CHAVE = 'visits/11111111-1111-1111-1111-111111111111.jpg';
const CONTEUDO = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);

let diretorio: string;
let storage: LocalFileStorage;

beforeEach(async () => {
  diretorio = await mkdtemp(path.join(tmpdir(), 'chokocrm-storage-'));
  storage = new LocalFileStorage(diretorio);
});

afterEach(async () => {
  await rm(diretorio, { recursive: true, force: true });
});

describe('LocalFileStorage', () => {
  it('grava o arquivo e lê de volta o mesmo conteúdo', async () => {
    await storage.save(CHAVE, CONTEUDO, 'image/jpeg');

    const gravado = await readFile(path.join(diretorio, CHAVE));
    expect(gravado.equals(CONTEUDO)).toBe(true);

    const lido = await storage.read(CHAVE);
    expect(lido.conteudo.equals(CONTEUDO)).toBe(true);
    expect(lido.contentType).toBe('image/jpeg');
  });

  it('deriva o contentType da extensão da chave', async () => {
    const chavePng = 'visits/22222222-2222-2222-2222-222222222222.png';
    const chaveWebp = 'visits/33333333-3333-3333-3333-333333333333.webp';

    await storage.save(chavePng, CONTEUDO, 'image/png');
    await storage.save(chaveWebp, CONTEUDO, 'image/webp');

    expect((await storage.read(chavePng)).contentType).toBe('image/png');
    expect((await storage.read(chaveWebp)).contentType).toBe('image/webp');
  });

  it('rejeita chave que tenta sair do diretório base', async () => {
    await expect(storage.save('visits/../../segredo.jpg', CONTEUDO, 'image/jpeg')).rejects.toBeInstanceOf(AppError);
    await expect(storage.read('../../../etc/passwd')).rejects.toBeInstanceOf(AppError);
  });

  it('rejeita extensão fora da lista de imagens', async () => {
    await expect(
      storage.save('visits/11111111-1111-1111-1111-111111111111.exe', CONTEUDO, 'image/jpeg'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('levanta NOT_FOUND ao ler chave inexistente', async () => {
    await expect(storage.read('visits/44444444-4444-4444-4444-444444444444.jpg')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });
});
