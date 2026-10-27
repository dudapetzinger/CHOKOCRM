import { CONTORNO_SC } from './contornoSC';
import { MUNICIPIOS_SC } from './municipiosSC';

/** Caixa que contém Santa Catarina com folga (lng −54..−48, lat −30..−25). */
function esperarDentroDeSC(aneis: [number, number][][]): void {
  for (const anel of aneis) {
    for (const [lng, lat] of anel) {
      expect(lng).toBeGreaterThan(-54);
      expect(lng).toBeLessThan(-48);
      expect(lat).toBeGreaterThan(-30);
      expect(lat).toBeLessThan(-25);
    }
  }
}

describe('CONTORNO_SC (arquivo gerado)', () => {
  it('o estado tem ao menos um anel e 50 pontos, dentro da caixa de SC', () => {
    expect(CONTORNO_SC.estado.length).toBeGreaterThanOrEqual(1);
    expect(CONTORNO_SC.estado.reduce((soma, anel) => soma + anel.length, 0)).toBeGreaterThanOrEqual(50);
    esperarDentroDeSC(CONTORNO_SC.estado);
  });

  it('todos os municípios do contorno existem na tabela de coordenadas, com a mesma chave', () => {
    const chaves = Object.keys(CONTORNO_SC.municipios);

    expect(chaves.length).toBeGreaterThanOrEqual(290);
    expect(chaves.filter((chave) => !(chave in MUNICIPIOS_SC))).toEqual([]);
  });

  it('cada município tem ao menos um anel de 4 pontos ou mais, dentro da caixa de SC', () => {
    for (const aneis of Object.values(CONTORNO_SC.municipios)) {
      expect(aneis.length).toBeGreaterThanOrEqual(1);
      for (const anel of aneis) expect(anel.length).toBeGreaterThanOrEqual(4);
      esperarDentroDeSC(aneis);
    }
  });
});
