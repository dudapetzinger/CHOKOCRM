import { cidadesDaCarteira, filtrarPorCidade } from './cidadesDaCarteira';

describe('cidadesDaCarteira', () => {
  it('agrupa grafias e ordena', () =>
    expect(cidadesDaCarteira([{ cidade: 'Pomerode' }, { cidade: 'blumenau ' }, { cidade: 'Blumenau' }])).toEqual([
      { chave: 'blumenau', nome: 'blumenau' },
      { chave: 'pomerode', nome: 'Pomerode' },
    ]));
});

describe('filtrarPorCidade', () => {
  it('filtra pela chave normalizada', () =>
    expect(filtrarPorCidade([{ cidade: 'Blumenau' }, { cidade: 'Pomerode' }], 'blumenau')).toEqual([
      { cidade: 'Blumenau' },
    ]));

  it('chave vazia devolve tudo', () =>
    expect(filtrarPorCidade([{ cidade: 'Blumenau' }, { cidade: 'Pomerode' }], '')).toHaveLength(2));
});
