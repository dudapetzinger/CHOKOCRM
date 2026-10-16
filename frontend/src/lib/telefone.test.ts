import { somenteDigitos, telefoneParaWaMe } from './telefone';

describe('somenteDigitos', () => {
  it('tira tudo que não é dígito', () => {
    expect(somenteDigitos('(47) 99900-8080')).toBe('47999008080');
    expect(somenteDigitos('+55 47 3333-4444')).toBe('554733334444');
    expect(somenteDigitos('')).toBe('');
  });
});

describe('telefoneParaWaMe', () => {
  it('acrescenta o 55 a um número nacional (DDD + número)', () => {
    expect(telefoneParaWaMe('(47) 99900-8080')).toBe('5547999008080');
    expect(telefoneParaWaMe('(47) 3333-4444')).toBe('554733334444');
  });

  it('não duplica o 55 quando o número já vem com o código do país', () => {
    expect(telefoneParaWaMe('+55 (47) 99900-8080')).toBe('5547999008080');
    expect(telefoneParaWaMe('55 47 3333-4444')).toBe('554733334444');
  });

  it('trata DDD 55 (RS) sem o código do país como número nacional', () => {
    expect(telefoneParaWaMe('(55) 99999-8888')).toBe('5555999998888');
    expect(telefoneParaWaMe('(55) 3222-1111')).toBe('555532221111');
  });

  it('descarta um único zero de tronco antes do DDD', () => {
    expect(telefoneParaWaMe('047 99900-8080')).toBe('5547999008080');
    expect(telefoneParaWaMe('(047) 3333-4444')).toBe('554733334444');
    expect(telefoneParaWaMe('0')).toBe('');
  });

  it('devolve vazio quando não há dígitos', () => {
    expect(telefoneParaWaMe('')).toBe('');
    expect(telefoneParaWaMe('sem telefone')).toBe('');
  });
});
