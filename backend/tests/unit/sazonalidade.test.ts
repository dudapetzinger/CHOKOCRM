import {
  dataDoEvento,
  EVENTOS_SAZONAIS,
  multiplicadorSazonal,
  NOME_DO_EVENTO,
  PRODUTOS_SUGERIDOS,
} from '../../src/config/sazonalidade';

describe('dataDoEvento', () => {
  it('calcula a Páscoa de 2026 em 05/04 e de 2027 em 28/03', () => {
    expect(dataDoEvento('PASCOA', 2026)).toBe('2026-04-05');
    expect(dataDoEvento('PASCOA', 2027)).toBe('2027-03-28');
  });

  it('Dia das Mães 2026 é 10/05 e Dia dos Pais 2026 é 09/08', () => {
    expect(dataDoEvento('DIA_DAS_MAES', 2026)).toBe('2026-05-10');
    expect(dataDoEvento('DIA_DOS_PAIS', 2026)).toBe('2026-08-09');
  });
});

describe('multiplicadorSazonal', () => {
  it('multiplicador é 2.0 nos 30 dias antes da Páscoa e 1.0 no dia seguinte', () => {
    expect(multiplicadorSazonal('2026-03-20')).toBe(2.0);
    expect(multiplicadorSazonal('2026-04-06')).toBe(1.0);
  });

  it('multiplicador é 1.6 antes do Dia dos Namorados', () => {
    expect(multiplicadorSazonal('2026-06-01')).toBe(1.6);
  });
});

describe('NOME_DO_EVENTO e PRODUTOS_SUGERIDOS', () => {
  it('todo evento tem nome legível e ao menos 2 produtos sugeridos', () => {
    for (const evento of EVENTOS_SAZONAIS) {
      expect(NOME_DO_EVENTO[evento].length).toBeGreaterThan(0);
      expect(PRODUTOS_SUGERIDOS[evento].length).toBeGreaterThanOrEqual(2);
    }
  });
});
