import { listarProdutos, montarMensagemDeEstoque } from '../../src/services/stock-message.template';

describe('listarProdutos', () => {
  it('lista 1, 2 e 3 produtos com vírgula e "e"', () => {
    expect(listarProdutos(['trufas'])).toBe('trufas');
    expect(listarProdutos(['trufas', 'barras'])).toBe('trufas e barras');
    expect(listarProdutos(['ovos de Páscoa', 'trufas', 'caixas presente'])).toBe(
      'ovos de Páscoa, trufas e caixas presente'
    );
  });

  it('lista vazia retorna string vazia', () => {
    expect(listarProdutos([])).toBe('');
  });
});

describe('montarMensagemDeEstoque', () => {
  it('monta a mensagem com evento', () => {
    expect(
      montarMensagemDeEstoque({
        nomeContato: 'Marta',
        nomeFantasia: 'Empório Pomerode',
        nomeRepresentante: 'Eduarda',
        evento: {
          nome: 'Páscoa',
          produtosSugeridos: ['ovos de Páscoa', 'trufas', 'caixas presente'],
        },
      })
    ).toBe(
      'Olá, Marta! Aqui é Eduarda, da Chokolaten. Páscoa está chegando. Como está o estoque de ovos de Páscoa, trufas e caixas presente na Empório Pomerode? Posso preparar uma reposição. 🍫'
    );
  });

  it('monta a mensagem genérica sem evento e com "cliente" sem contato', () => {
    expect(
      montarMensagemDeEstoque({
        nomeContato: null,
        nomeFantasia: 'Empório Pomerode',
        nomeRepresentante: 'Eduarda',
        evento: null,
      })
    ).toBe(
      'Olá, cliente! Aqui é Eduarda, da Chokolaten. Como está o estoque de chocolates na Empório Pomerode? Posso preparar uma reposição. 🍫'
    );
  });

  it('trata evento com produtosSugeridos vazio como mensagem genérica', () => {
    expect(
      montarMensagemDeEstoque({
        nomeContato: 'Marta',
        nomeFantasia: 'Empório Pomerode',
        nomeRepresentante: 'Eduarda',
        evento: { nome: 'Páscoa', produtosSugeridos: [] },
      })
    ).toBe(
      'Olá, Marta! Aqui é Eduarda, da Chokolaten. Como está o estoque de chocolates na Empório Pomerode? Posso preparar uma reposição. 🍫'
    );
  });
});
