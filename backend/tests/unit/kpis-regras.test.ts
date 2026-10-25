import type { ResultadoVisita } from '@prisma/client';
import type { Cor } from '../../src/services/classificacao.service';
import {
  contarInativos,
  contarVisitas,
  conversaoEmVendas,
  distribuicaoPorCor,
  janelaDoPeriodo,
  mediaDeVisitasPorCliente,
  periodoDeAnalise,
  taxaDeRegistro,
  type VisitaDoPeriodo,
} from '../../src/services/kpis.regras';

function visitas(resultado: ResultadoVisita, quantidade: number, clientId = 'c'): VisitaDoPeriodo[] {
  return Array.from({ length: quantidade }, () => ({ clientId, resultado }));
}

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, i) => `c${i + 1}`);
}

describe('janelaDoPeriodo', () => {
  it('sem nada: 30 dias terminando hoje', () => {
    expect(janelaDoPeriodo({}, '2026-10-07')).toEqual({ dias: 30, inicio: '2026-09-08', fim: '2026-10-07' });
  });

  it('com periodoDias: o mesmo de periodoDeAnalise, com os dias', () => {
    expect(janelaDoPeriodo({ periodoDias: 365 }, '2026-10-07')).toEqual({
      dias: 365,
      inicio: '2025-10-08',
      fim: '2026-10-07',
    });
  });

  it('com datas: usa as datas e dias conta as duas pontas', () => {
    expect(janelaDoPeriodo({ inicio: '2026-10-01', fim: '2026-10-07' }, '2026-10-07')).toEqual({
      dias: 7,
      inicio: '2026-10-01',
      fim: '2026-10-07',
    });
    expect(janelaDoPeriodo({ inicio: '2026-10-07', fim: '2026-10-07' }, '2026-10-07').dias).toBe(1);
  });

  it('atravessa a virada de ano e o fevereiro bissexto', () => {
    expect(janelaDoPeriodo({ inicio: '2026-12-30', fim: '2027-01-02' }, '2027-01-10').dias).toBe(4);
    expect(janelaDoPeriodo({ inicio: '2028-02-28', fim: '2028-03-01' }, '2028-03-10').dias).toBe(3);
  });
});

describe('periodoDeAnalise', () => {
  it("30 dias a partir de 2026-10-07 → ['2026-09-08', '2026-10-07']; 365 → ['2025-10-08', '2026-10-07']", () => {
    expect(periodoDeAnalise('2026-10-07', 30)).toEqual({ inicio: '2026-09-08', fim: '2026-10-07' });
    expect(periodoDeAnalise('2026-10-07', 365)).toEqual({ inicio: '2025-10-08', fim: '2026-10-07' });
  });

  it("virada de ano: 2027-01-10 com 30 → inicio '2026-12-12'", () => {
    expect(periodoDeAnalise('2027-01-10', 30)).toEqual({ inicio: '2026-12-12', fim: '2027-01-10' });
  });
});

describe('contarVisitas / mediaDeVisitasPorCliente', () => {
  it('24 visitas e 9 clientes → média 2.7; 0 clientes → null; 0 visitas e 9 clientes → 0', () => {
    const total = contarVisitas(visitas('VENDA', 24));

    expect(total).toBe(24);
    expect(mediaDeVisitasPorCliente(total, 9)).toBe(2.7);
    expect(mediaDeVisitasPorCliente(total, 0)).toBeNull();
    expect(mediaDeVisitasPorCliente(contarVisitas([]), 9)).toBe(0);
  });
});

describe('taxaDeRegistro', () => {
  it('cliente com visita, cliente só com mensagem e cliente com os dois (conta uma vez): 3 de 4 → 75', () => {
    const resultado = taxaDeRegistro(
      [...visitas('VENDA', 1, 'c1'), ...visitas('SEM_VENDA', 2, 'c3')],
      [{ clientId: 'c2' }, { clientId: 'c3' }],
      ids(4),
    );

    expect(resultado).toEqual({ numerador: 3, denominador: 4, percentual: 75 });
  });

  it('visita/mensagem de clientId fora da lista de ativos não entra; lista vazia → { 0, 0, null }', () => {
    const resultado = taxaDeRegistro(visitas('VENDA', 1, 'fora'), [{ clientId: 'fora2' }], ['c1', 'c2']);

    expect(resultado).toEqual({ numerador: 0, denominador: 2, percentual: 0 });
    expect(taxaDeRegistro(visitas('VENDA', 2, 'c1'), [{ clientId: 'c1' }], [])).toEqual({
      numerador: 0,
      denominador: 0,
      percentual: null,
    });
  });

  it('7 de 9 → 78; 1 de 8 → 13 (arredonda .5 para cima)', () => {
    const lista9 = ids(9);
    const com7 = lista9.slice(0, 7).map((clientId) => ({ clientId }));

    expect(taxaDeRegistro([], com7, lista9).percentual).toBe(78);
    expect(taxaDeRegistro([], [{ clientId: 'c1' }], ids(8)).percentual).toBe(13);
  });
});

describe('conversaoEmVendas', () => {
  it('15 VENDA em 24 → 63 (62,5 arredonda para cima, como 1 de 8 → 13); NEGOCIACAO e SEM_VENDA não contam; sem visitas → { 0, 0, null }', () => {
    const periodo = [...visitas('VENDA', 15), ...visitas('NEGOCIACAO', 4), ...visitas('SEM_VENDA', 5)];

    expect(conversaoEmVendas(periodo)).toEqual({ numerador: 15, denominador: 24, percentual: 63 });
    expect(conversaoEmVendas([])).toEqual({ numerador: 0, denominador: 0, percentual: null });
  });
});

describe('distribuicaoPorCor / contarInativos', () => {
  it('sempre as quatro chaves; [] → tudo 0; VERDE×3, AMARELO×2, LARANJA×2, VERMELHO×2 → inativos 4', () => {
    expect(distribuicaoPorCor([])).toEqual({ VERDE: 0, AMARELO: 0, LARANJA: 0, VERMELHO: 0 });

    const cores: Cor[] = [
      'VERDE', 'VERDE', 'VERDE',
      'AMARELO', 'AMARELO',
      'LARANJA', 'LARANJA',
      'VERMELHO', 'VERMELHO',
    ];
    const distribuicao = distribuicaoPorCor(cores);

    expect(distribuicao).toEqual({ VERDE: 3, AMARELO: 2, LARANJA: 2, VERMELHO: 2 });
    expect(contarInativos(distribuicao)).toBe(4);
    expect(contarInativos(distribuicaoPorCor([]))).toBe(0);
  });
});
