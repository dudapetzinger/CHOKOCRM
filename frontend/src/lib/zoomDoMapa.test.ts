import {
  FATOR_DO_ZOOM,
  NIVEL_MAXIMO,
  NIVEL_MINIMO,
  afastar,
  ajustar,
  aplicarFator,
  aproximar,
  conterCaixa,
  deslocar,
  nivelDoZoom,
  nivelMinimoParaCaber,
  reenquadrar,
  type ViewBox,
} from './zoomDoMapa';

const INICIAL: ViewBox = { x: 0, y: 0, largura: 520, altura: 300 };

/** Igualdade a 2 casas em cada campo (o resíduo de ponto flutuante das contas encadeadas não importa). */
function esperarViewBox(atual: ViewBox, esperado: ViewBox): void {
  expect(atual.x).toBeCloseTo(esperado.x, 2);
  expect(atual.y).toBeCloseTo(esperado.y, 2);
  expect(atual.largura).toBeCloseTo(esperado.largura, 2);
  expect(atual.altura).toBeCloseTo(esperado.altura, 2);
}

describe('nivelDoZoom', () => {
  it('é 1 no enquadramento inicial e a razão das larguras depois', () => {
    expect(nivelDoZoom(INICIAL, INICIAL)).toBe(1);
    expect(nivelDoZoom({ x: 130, y: 75, largura: 260, altura: 150 }, INICIAL)).toBe(2);
    expect(nivelDoZoom({ x: -260, y: -150, largura: 1040, altura: 600 }, INICIAL)).toBe(0.5);
  });
});

describe('aproximar', () => {
  it('o fator é 1,5 por toque, de 0,5× a 6×', () => {
    expect(FATOR_DO_ZOOM).toBe(1.5);
    expect(NIVEL_MINIMO).toBe(0.5);
    expect(NIVEL_MAXIMO).toBe(6);
  });

  it('encolhe o viewBox 1,5× em torno do centro', () => {
    const atual = aproximar(INICIAL, INICIAL);

    expect(atual).toEqual({ x: 86.667, y: 50, largura: 346.667, altura: 200 });
    expect(nivelDoZoom(atual, INICIAL)).toBe(1.5);
  });

  it('mantém o ponto pedido no mesmo lugar da tela', () => {
    // O canto superior esquerdo como centro: ele continua sendo o canto.
    expect(aproximar(INICIAL, INICIAL, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, largura: 346.667, altura: 200 });
    // Um ponto a 1/4 da largura e 1/4 da altura continua a 1/4.
    const atual = aproximar(INICIAL, INICIAL, { x: 130, y: 75 });
    expect((130 - atual.x) / atual.largura).toBeCloseTo(0.25, 3);
    expect((75 - atual.y) / atual.altura).toBeCloseTo(0.25, 3);
  });

  it('para exatamente em 6×, sem passar nem ficar antes', () => {
    let atual = INICIAL;
    for (let i = 0; i < 10; i++) atual = aproximar(atual, INICIAL);

    expect(nivelDoZoom(atual, INICIAL)).toBe(NIVEL_MAXIMO);
    esperarViewBox(atual, { x: 260 - 520 / 12, y: 150 - 300 / 12, largura: 520 / 6, altura: 300 / 6 });
    expect(aproximar(atual, INICIAL)).toEqual(atual);
  });

  it('arredonda a 3 casas', () => {
    const atual = aproximar(INICIAL, INICIAL, { x: 123.4567, y: 76.5432 });

    for (const valor of Object.values(atual)) {
      expect(Math.round(valor * 1000) / 1000).toBe(valor);
    }
  });
});

describe('afastar', () => {
  it('alarga o viewBox 1,5× em torno do centro e desfaz o aproximar', () => {
    expect(afastar(INICIAL, INICIAL)).toEqual({ x: -130, y: -75, largura: 780, altura: 450 });
    esperarViewBox(afastar(aproximar(INICIAL, INICIAL), INICIAL), INICIAL);
  });

  it('para exatamente em 0,5×', () => {
    let atual = INICIAL;
    for (let i = 0; i < 10; i++) atual = afastar(atual, INICIAL);

    expect(nivelDoZoom(atual, INICIAL)).toBe(NIVEL_MINIMO);
    esperarViewBox(atual, { x: -260, y: -150, largura: 1040, altura: 600 });
    expect(afastar(atual, INICIAL)).toEqual(atual);
  });

  it('com um mínimo menor nos limites, passa de 0,5× e para exatamente nele', () => {
    const limites = { minimo: 0.2 };
    let atual = INICIAL;
    for (let i = 0; i < 10; i++) atual = afastar(atual, INICIAL, undefined, limites);

    expect(nivelDoZoom(atual, INICIAL)).toBe(0.2);
    esperarViewBox(atual, { x: -1040, y: -600, largura: 2600, altura: 1500 });
    expect(afastar(atual, INICIAL, undefined, limites)).toEqual(atual);
    // Sem os limites, o mesmo viewBox volta para 0,5× (o mínimo padrão).
    expect(nivelDoZoom(afastar(atual, INICIAL), INICIAL)).toBe(NIVEL_MINIMO);
  });
});

describe('nivelMinimoParaCaber', () => {
  const INICIAL_DO_CELULAR: ViewBox = { x: 0, y: 0, largura: 311, altura: 220 };

  it('é 0,5× quando a caixa já cabe em 0,5×', () => {
    expect(nivelMinimoParaCaber(INICIAL, { minX: -200, minY: -100, maxX: 700, maxY: 400 })).toBe(NIVEL_MINIMO);
    // A caixa do tamanho exato do 0,5× ainda cabe.
    expect(nivelMinimoParaCaber(INICIAL, { minX: -260, minY: -150, maxX: 780, maxY: 450 })).toBe(NIVEL_MINIMO);
    // Caixa sem extensão: cabe em qualquer nível.
    expect(nivelMinimoParaCaber(INICIAL, { minX: 10, minY: 10, maxX: 10, maxY: 10 })).toBe(NIVEL_MINIMO);
  });

  it('é o nível em que a caixa cabe quando ela não cabe em 0,5× (pela largura ou pela altura)', () => {
    // Largura 1500 em 311: 311 / 1500 ≈ 0,207 (a altura cabe em 0,5×).
    expect(nivelMinimoParaCaber(INICIAL_DO_CELULAR, { minX: -600, minY: 0, maxX: 900, maxY: 220 })).toBe(0.207);
    // Altura 880 em 220: 220 / 880 = 0,25, menor que o 0,5× da largura.
    expect(nivelMinimoParaCaber(INICIAL_DO_CELULAR, { minX: 0, minY: -330, maxX: 311, maxY: 550 })).toBe(0.25);
  });

  it('trunca a 3 casas para baixo: no nível devolvido, a caixa cabe de fato', () => {
    // 311 / 900 = 0,34555…: arredondar daria 0,346, e 311 / 0,346 = 898,8 < 900 (a caixa não caberia).
    const larga = { minX: 0, minY: 0, maxX: 900, maxY: 100 };
    const nivelLarga = nivelMinimoParaCaber(INICIAL_DO_CELULAR, larga);
    expect(nivelLarga).toBe(0.345);
    expect(311 / nivelLarga).toBeGreaterThanOrEqual(900);

    const caixa = { minX: 0, minY: 0, maxX: 1000, maxY: 100 };
    const nivel = nivelMinimoParaCaber({ x: 0, y: 0, largura: 310, altura: 220 }, caixa);

    expect(nivel).toBe(0.31);
    expect(310 / nivel).toBeGreaterThanOrEqual(1000);
    expect(nivelMinimoParaCaber({ x: 0, y: 0, largura: 311, altura: 220 }, caixa)).toBe(0.311);
  });
});

describe('conterCaixa', () => {
  const CAIXA = { minX: 100, minY: 50, maxX: 400, maxY: 250 };

  it('não mexe quando a caixa já está inteira dentro', () => {
    expect(conterCaixa(INICIAL, CAIXA)).toEqual(INICIAL);
  });

  it('desloca o mínimo em cada eixo para a caixa entrar', () => {
    // A caixa saiu pela esquerda e por cima: a borda do viewBox encosta nela.
    expect(conterCaixa({ x: 150, y: 80, largura: 520, altura: 300 }, CAIXA)).toEqual({ x: 100, y: 50, largura: 520, altura: 300 });
    // Saiu pela direita e por baixo.
    expect(conterCaixa({ x: -300, y: -200, largura: 520, altura: 300 }, CAIXA)).toEqual({ x: -120, y: -50, largura: 520, altura: 300 });
    // Só um eixo precisa.
    expect(conterCaixa({ x: 150, y: 0, largura: 520, altura: 300 }, CAIXA)).toEqual({ x: 100, y: 0, largura: 520, altura: 300 });
  });

  it('caixa maior que o viewBox num eixo: centraliza nesse eixo', () => {
    expect(conterCaixa({ x: 0, y: 0, largura: 200, altura: 300 }, CAIXA)).toEqual({ x: 150, y: 0, largura: 200, altura: 300 });
  });

  it('arredonda a 3 casas', () => {
    const contido = conterCaixa({ x: 150, y: 80, largura: 520, altura: 300 }, { ...CAIXA, minX: 100.12345, minY: 50.98765 });

    expect(contido.x).toBe(100.123);
    expect(contido.y).toBe(50.988);
  });
});

describe('aplicarFator', () => {
  it('qualquer fator (a pinça), em torno do ponto, dentro dos limites', () => {
    expect(aplicarFator(INICIAL, INICIAL, 2, { x: 0, y: 0 })).toEqual({ x: 0, y: 0, largura: 260, altura: 150 });
    esperarViewBox(aplicarFator(INICIAL, INICIAL, 100), {
      x: 260 - 520 / 12,
      y: 150 - 300 / 12,
      largura: 520 / 6,
      altura: 300 / 6,
    });
    expect(nivelDoZoom(aplicarFator(INICIAL, INICIAL, 0.01), INICIAL)).toBe(NIVEL_MINIMO);
  });

  it('respeita os limites passados (mínimo e máximo)', () => {
    const limites = { minimo: 0.25, maximo: 4 };
    expect(nivelDoZoom(aplicarFator(INICIAL, INICIAL, 0.01, undefined, limites), INICIAL)).toBe(0.25);
    expect(nivelDoZoom(aplicarFator(INICIAL, INICIAL, 100, undefined, limites), INICIAL)).toBe(4);
    expect(nivelDoZoom(aproximar(INICIAL, INICIAL, undefined, { maximo: 1.2 }), INICIAL)).toBe(1.2);
  });
});

describe('deslocar', () => {
  it('move a origem do viewBox pelo deslocamento, sem mudar o tamanho', () => {
    expect(deslocar(INICIAL, 10, -5.5)).toEqual({ x: 10, y: -5.5, largura: 520, altura: 300 });
    expect(deslocar({ x: 10, y: -5.5, largura: 520, altura: 300 }, -10, 5.5)).toEqual(INICIAL);
  });

  it('arredonda a 3 casas', () => {
    expect(deslocar(INICIAL, 0.12345, 0.98765)).toEqual({ x: 0.123, y: 0.988, largura: 520, altura: 300 });
  });
});

describe('ajustar', () => {
  it('volta ao enquadramento inicial (uma cópia)', () => {
    const ajustado = ajustar(INICIAL);

    expect(ajustado).toEqual(INICIAL);
    expect(ajustado).not.toBe(INICIAL);
  });
});

describe('reenquadrar', () => {
  const INICIAL_NOVO: ViewBox = { x: 0, y: 0, largura: 1040, altura: 600 };

  it('no nível 1, é o novo enquadramento inicial', () => {
    expect(reenquadrar(INICIAL, INICIAL, INICIAL_NOVO)).toEqual(INICIAL_NOVO);
  });

  it('mantém o nível e a posição relativa quando a largura muda', () => {
    const aproximado = aproximar(INICIAL, INICIAL, { x: 0, y: 0 });
    const reenquadrado = reenquadrar(aproximado, INICIAL, INICIAL_NOVO);

    expect(nivelDoZoom(reenquadrado, INICIAL_NOVO)).toBe(1.5);
    esperarViewBox(reenquadrado, { x: 0, y: 0, largura: 1040 / 1.5, altura: 400 });
  });

  it('o deslocamento acompanha, proporcional', () => {
    const deslocado = deslocar(INICIAL, 52, 30);
    esperarViewBox(reenquadrar(deslocado, INICIAL, INICIAL_NOVO), { x: 104, y: 60, largura: 1040, altura: 600 });
  });
});
