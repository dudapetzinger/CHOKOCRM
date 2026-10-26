import { distribuirRotulos, encurtarRotulo } from './rotulosDosEventos';

describe('distribuirRotulos', () => {
  it('Páscoa (x=120) invade o lugar de Dia das Mães (x=150): Dia das Mães desce para a linha 1', () => {
    expect(
      distribuirRotulos([
        { chave: 'PASCOA', x: 120, nome: 'Páscoa' },
        { chave: 'DIA_DAS_MAES', x: 150, nome: 'Dia das Mães' },
      ]),
    ).toEqual([
      { chave: 'PASCOA', linha: 0, texto: 'Páscoa' },
      { chave: 'DIA_DAS_MAES', linha: 1, texto: 'Dia das Mães' },
    ]);
  });

  it('três marcas afastadas ficam todas na linha 0', () => {
    expect(
      distribuirRotulos([
        { chave: 'PASCOA', x: 40, nome: 'Páscoa' },
        { chave: 'DIA_DAS_MAES', x: 150, nome: 'Dia das Mães' },
        { chave: 'NATAL', x: 300, nome: 'Natal' },
      ]).map(({ linha }) => linha),
    ).toEqual([0, 0, 0]);
  });

  it('em ordem de x; a terceira volta à linha 0 só quando já cabe depois do último rótulo da linha 0', () => {
    // "Dia das Mães" em x=100 vai até 100 + 3 + 12 × 5,6 = 170,2.
    expect(
      distribuirRotulos([
        { chave: 'C', x: 180, nome: 'Natal' },
        { chave: 'A', x: 100, nome: 'Dia das Mães' },
        { chave: 'B', x: 130, nome: 'Páscoa' },
        { chave: 'D', x: 190, nome: 'Dia dos Pais' },
      ]),
    ).toEqual([
      { chave: 'A', linha: 0, texto: 'Dia das Mães' },
      { chave: 'B', linha: 1, texto: 'Páscoa' },
      { chave: 'C', linha: 0, texto: 'Natal' },
      // "Natal" em x=180 vai até 180 + 3 + 5 × 5,6 = 211: x=190 não cabe na linha 0.
      { chave: 'D', linha: 1, texto: 'Dia dos Pais' },
    ]);
  });

  it('sem lugar em nenhuma das linhas, vai à linha que termina antes', () => {
    expect(
      distribuirRotulos([
        { chave: 'A', x: 0, nome: 'Dia das Mães' }, // linha 0 até 70,2
        { chave: 'B', x: 30, nome: 'Dia dos Pais' }, // linha 1 até 100,2
        { chave: 'C', x: 80, nome: 'Natal' }, // cabe na linha 0: até 111
        { chave: 'D', x: 90, nome: 'Páscoa' }, // não cabe: a linha 1 (100,2) termina antes; até 126,6
        { chave: 'E', x: 105, nome: 'Natal' }, // não cabe: a linha 0 (111) termina antes
      ]).map(({ linha }) => linha),
    ).toEqual([0, 1, 0, 1, 0]);
  });

  it('aceita outra largura de caractere e outra folga', () => {
    expect(
      distribuirRotulos(
        [
          { chave: 'A', x: 0, nome: 'abcde' },
          { chave: 'B', x: 20, nome: 'x' },
        ],
        4,
        0,
      ).map(({ linha }) => linha),
    ).toEqual([0, 0]);
  });
});

describe('encurtarRotulo', () => {
  it('nomes de até 10 caracteres ficam inteiros', () => {
    expect(encurtarRotulo('Páscoa')).toBe('Páscoa');
    expect(encurtarRotulo('Natal')).toBe('Natal');
  });

  it('os mais longos ficam com as palavras que cabem nos 10 primeiros caracteres, e "…"', () => {
    expect(encurtarRotulo('Dia dos Namorados')).toBe('Dia dos…');
    expect(encurtarRotulo('Dia das Mães')).toBe('Dia das…');
    expect(encurtarRotulo('Black Friday')).toBe('Black…');
  });

  it('sem espaço para cortar, ficam os 9 primeiros caracteres', () => {
    expect(encurtarRotulo('Superpromoção')).toBe('Superprom…');
  });
});
