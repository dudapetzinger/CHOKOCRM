import {
  FATOR_DO_ZOOM,
  NIVEL_MAXIMO,
  NIVEL_MINIMO,
  afastar,
  ajustar,
  aplicarFator,
  aproximar,
  deslocar,
  nivelDoZoom,
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
