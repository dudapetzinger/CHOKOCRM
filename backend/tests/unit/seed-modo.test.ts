import { AVISO_RESET_EM_PRODUCAO, modoDoSeed } from '../../src/seed/demonstracao';

describe('modoDoSeed', () => {
  it('sem --reset, só acrescenta, em qualquer ambiente', () => {
    expect(modoDoSeed([], 'development')).toBe('semear');
    expect(modoDoSeed([], 'production')).toBe('semear');
    expect(modoDoSeed(['--confirmar'], 'production')).toBe('semear');
  });

  it('com --reset fora de produção, reinicia sem pedir confirmação', () => {
    expect(modoDoSeed(['--reset'], 'development')).toBe('reiniciar');
    expect(modoDoSeed(['--reset'], 'test')).toBe('reiniciar');
  });

  it('com --reset em produção, recusa sem --confirmar e reinicia com ele', () => {
    expect(modoDoSeed(['--reset'], 'production')).toBe('recusar');
    expect(modoDoSeed(['--reset', '--confirmar'], 'production')).toBe('reiniciar');
    expect(modoDoSeed(['--confirmar', '--reset'], 'production')).toBe('reiniciar');
  });

  it('o aviso diz o que é apagado, que só as contas ficam e como confirmar', () => {
    expect(AVISO_RESET_EM_PRODUCAO).toContain('representantes de verdade');
    expect(AVISO_RESET_EM_PRODUCAO).toContain('só as contas ficam');
    expect(AVISO_RESET_EM_PRODUCAO).toContain('npm run db:seed:reset -- --confirmar');
  });
});
