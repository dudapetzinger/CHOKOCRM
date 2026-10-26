import { posicaoDoBalao } from './posicaoDoBalao';

const area = { left: 100, top: 50, width: 400, height: 300 };
const balao = { largura: 120, altura: 60 };

describe('posicaoDoBalao', () => {
  it('centraliza acima quando cabe', () => {
    // Gatilho de 40 px de largura em x 300..340 (relativo à área: 200..240), 150 px abaixo do topo.
    const gatilho = { left: 300, top: 200, width: 40, height: 20 };

    expect(posicaoDoBalao(gatilho, area, balao)).toEqual({
      x: 200 + 20 - 60, // centro do gatilho menos metade do balão
      y: 150 - 60 - 8, // topo do gatilho menos a altura e a margem
      acima: true,
    });
  });

  it('vira para baixo sem espaço em cima', () => {
    // Só 30 px entre o topo da área e o gatilho: não cabem 60 + 8.
    const gatilho = { left: 300, top: 80, width: 40, height: 20 };

    expect(posicaoDoBalao(gatilho, area, balao)).toEqual({
      x: 160,
      y: 30 + 20 + 8, // embaixo do gatilho, com a margem
      acima: false,
    });
  });

  it('na borda direita, x = area.width - largura (não sai da área)', () => {
    const gatilho = { left: 490, top: 200, width: 10, height: 10 };

    expect(posicaoDoBalao(gatilho, area, balao).x).toBe(area.width - balao.largura);
  });

  it('na borda esquerda, x = 0', () => {
    const gatilho = { left: 100, top: 200, width: 10, height: 10 };

    expect(posicaoDoBalao(gatilho, area, balao).x).toBe(0);
  });

  it('respeita a margem informada', () => {
    const gatilho = { left: 300, top: 200, width: 40, height: 20 };

    expect(posicaoDoBalao(gatilho, area, balao, 4).y).toBe(150 - 60 - 4);
  });
});
