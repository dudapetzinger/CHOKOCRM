import { rotaInicialDoPapel } from './rotaInicial';

describe('rotaInicialDoPapel', () => {
  it('o gestor começa pelo Painel', () => {
    expect(rotaInicialDoPapel('GESTOR')).toBe('/painel');
  });

  it('o representante começa pela Agenda', () => {
    expect(rotaInicialDoPapel('REPRESENTANTE')).toBe('/agenda');
  });
});
