import { AVISO_RESET_SEM_CONFIRMACAO, modoDoSeed } from '../../src/seed/demonstracao';

const LOCAL = 'postgresql://chokocrm:senha@localhost:5432/chokocrm';
const REMOTO = 'postgresql://chokocrm:senha@chokocrm-db.postgres.database.azure.com:5432/chokocrm?sslmode=require';

describe('modoDoSeed', () => {
  it('sem --reset, só acrescenta, em qualquer ambiente e com qualquer banco', () => {
    expect(modoDoSeed([], 'development', LOCAL)).toBe('semear');
    expect(modoDoSeed([], 'production', REMOTO)).toBe('semear');
    expect(modoDoSeed(['--confirmar'], 'production', REMOTO)).toBe('semear');
  });

  it('com --reset em banco local fora de produção, reinicia sem pedir confirmação', () => {
    expect(modoDoSeed(['--reset'], 'development', LOCAL)).toBe('reiniciar');
    expect(modoDoSeed(['--reset'], 'test', LOCAL)).toBe('reiniciar');
  });

  it.each([
    'postgresql://u:p@localhost:5432/d',
    'postgresql://u:p@LOCALHOST:5432/d',
    'postgresql://u:p@127.0.0.1:5432/d',
    'postgresql://u:p@[::1]:5432/d',
    'postgresql://u:p@db:5432/d',
  ])('o host local de %s não exige confirmação', (url) => {
    expect(modoDoSeed(['--reset'], 'development', url)).toBe('reiniciar');
  });

  it('com --reset em banco remoto, mesmo em development, recusa sem --confirmar e reinicia com ele', () => {
    expect(modoDoSeed(['--reset'], 'development', REMOTO)).toBe('recusar');
    expect(modoDoSeed(['--reset'], 'test', REMOTO)).toBe('recusar');
    expect(modoDoSeed(['--reset', '--confirmar'], 'development', REMOTO)).toBe('reiniciar');
  });

  it('URL malformada conta como banco remoto', () => {
    expect(modoDoSeed(['--reset'], 'development', 'isto não é uma url')).toBe('recusar');
    expect(modoDoSeed(['--reset'], 'development', '')).toBe('recusar');
    expect(modoDoSeed(['--reset', '--confirmar'], 'development', '')).toBe('reiniciar');
  });

  it('com --reset em produção, recusa sem --confirmar e reinicia com ele, mesmo com banco local', () => {
    expect(modoDoSeed(['--reset'], 'production', LOCAL)).toBe('recusar');
    expect(modoDoSeed(['--reset'], 'production', REMOTO)).toBe('recusar');
    expect(modoDoSeed(['--reset', '--confirmar'], 'production', REMOTO)).toBe('reiniciar');
    expect(modoDoSeed(['--confirmar', '--reset'], 'production', LOCAL)).toBe('reiniciar');
  });

  it('o aviso diz o que é apagado, que só as contas ficam e como confirmar', () => {
    expect(AVISO_RESET_SEM_CONFIRMACAO).toContain('produção ou o banco é remoto');
    expect(AVISO_RESET_SEM_CONFIRMACAO).toContain('representantes de verdade');
    expect(AVISO_RESET_SEM_CONFIRMACAO).toContain('só as contas ficam');
    expect(AVISO_RESET_SEM_CONFIRMACAO).toContain('npm run db:seed:reset -- --confirmar');
  });
});
