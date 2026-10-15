import { descreverSituacao, formatarDias } from './descreverSituacao';

describe('descreverSituacao', () => {
  it('VERMELHO nunca visitado', () => {
    expect(descreverSituacao({ cor: 'VERMELHO', diasSemVisita: null, rebaixadoPorVenda: false })).toBe(
      'Nunca visitado',
    );
  });

  it('VERMELHO com dias sem visita', () => {
    expect(descreverSituacao({ cor: 'VERMELHO', diasSemVisita: 45, rebaixadoPorVenda: false })).toBe(
      'Atrasado · 45 dias sem visita',
    );
  });

  it('LARANJA rebaixado por venda, com diasSemCompra', () => {
    expect(
      descreverSituacao({ cor: 'LARANJA', diasSemVisita: 5, rebaixadoPorVenda: true, diasSemCompra: 72 }),
    ).toBe('Sem compra há 72 dias');
  });

  it('LARANJA rebaixado por venda, sem diasSemCompra (lista)', () => {
    expect(descreverSituacao({ cor: 'LARANJA', diasSemVisita: 5, rebaixadoPorVenda: true })).toBe(
      'Rebaixado: sem compra há mais de 60 dias',
    );
    expect(
      descreverSituacao({ cor: 'LARANJA', diasSemVisita: 5, rebaixadoPorVenda: true, diasSemCompra: null }),
    ).toBe('Rebaixado: sem compra há mais de 60 dias');
  });

  it('LARANJA por visita', () => {
    expect(descreverSituacao({ cor: 'LARANJA', diasSemVisita: 16, rebaixadoPorVenda: false })).toBe(
      'Vencendo · 16 dias sem visita',
    );
  });

  it('AMARELO', () => {
    expect(descreverSituacao({ cor: 'AMARELO', diasSemVisita: 7, rebaixadoPorVenda: false })).toBe(
      'Visitado sem venda · há 7 dias',
    );
  });

  it('VERDE', () => {
    expect(descreverSituacao({ cor: 'VERDE', diasSemVisita: 3, rebaixadoPorVenda: false })).toBe(
      'Em dia · visita há 3 dias, com venda',
    );
  });

  it('VERDE visitado hoje', () => {
    expect(descreverSituacao({ cor: 'VERDE', diasSemVisita: 0, rebaixadoPorVenda: false })).toBe(
      'Em dia · visita hoje, com venda',
    );
  });

  it('VERDE visitado ontem', () => {
    expect(descreverSituacao({ cor: 'VERDE', diasSemVisita: 1, rebaixadoPorVenda: false })).toBe(
      'Em dia · visita ontem, com venda',
    );
  });

  it('AMARELO visitado hoje', () => {
    expect(descreverSituacao({ cor: 'AMARELO', diasSemVisita: 0, rebaixadoPorVenda: false })).toBe(
      'Visitado sem venda · hoje',
    );
  });

  it('AMARELO visitado ontem', () => {
    expect(descreverSituacao({ cor: 'AMARELO', diasSemVisita: 1, rebaixadoPorVenda: false })).toBe(
      'Visitado sem venda · ontem',
    );
  });
});

describe('formatarDias', () => {
  it('0 é hoje, 1 é ontem, demais "{n} dias"', () => {
    expect(formatarDias(0)).toBe('hoje');
    expect(formatarDias(1)).toBe('ontem');
    expect(formatarDias(2)).toBe('2 dias');
    expect(formatarDias(31)).toBe('31 dias');
  });
});
