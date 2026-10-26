import { contar } from './contar';

describe('contar', () => {
  it('singular só com 1; zero e mais de um vão no plural', () => {
    expect(contar(1, 'cliente')).toBe('1 cliente');
    expect(contar(0, 'cliente')).toBe('0 clientes');
    expect(contar(3, 'visita')).toBe('3 visitas');
  });

  it('aceita um plural próprio', () => {
    expect(contar(1, 'cliente ativo', 'clientes ativos')).toBe('1 cliente ativo');
    expect(contar(12, 'cliente ativo', 'clientes ativos')).toBe('12 clientes ativos');
  });
});
