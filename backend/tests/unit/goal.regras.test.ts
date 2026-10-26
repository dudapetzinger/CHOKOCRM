import { Prisma } from '@prisma/client';
import { metaDentroDaCampanha, periodoDaMeta, realizadoDaMeta } from '../../src/services/goal.regras';

describe('periodoDaMeta (spec 7.8)', () => {
  it('semanal: base numa quinta (15/10/2026) → segunda 12/10 a domingo 18/10', () => {
    expect(periodoDaMeta('SEMANAL', '2026-10-15')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' });
  });

  it('semanal: base no domingo (18/10/2026) → a mesma semana (o domingo fecha a semana)', () => {
    expect(periodoDaMeta('SEMANAL', '2026-10-18')).toEqual({ inicio: '2026-10-12', fim: '2026-10-18' });
  });

  it('semanal: base na segunda (19/10/2026) → 19/10 a 25/10', () => {
    expect(periodoDaMeta('SEMANAL', '2026-10-19')).toEqual({ inicio: '2026-10-19', fim: '2026-10-25' });
  });

  it('semanal: atravessa a virada do ano', () => {
    expect(periodoDaMeta('SEMANAL', '2027-01-01')).toEqual({ inicio: '2026-12-28', fim: '2027-01-03' });
  });

  it('mensal: primeiro ao último dia do mês da base', () => {
    expect(periodoDaMeta('MENSAL', '2026-10-15')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' });
    expect(periodoDaMeta('MENSAL', '2026-11-30')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' });
  });

  it('mensal: fevereiro de 2028 (bissexto) termina em 29; o de 2027, em 28', () => {
    expect(periodoDaMeta('MENSAL', '2028-02-10')).toEqual({ inicio: '2028-02-01', fim: '2028-02-29' });
    expect(periodoDaMeta('MENSAL', '2027-02-10')).toEqual({ inicio: '2027-02-01', fim: '2027-02-28' });
  });

  it('mensal: dezembro termina em 31', () => {
    expect(periodoDaMeta('MENSAL', '2026-12-01')).toEqual({ inicio: '2026-12-01', fim: '2026-12-31' });
  });
});

describe('realizadoDaMeta (spec 7.8)', () => {
  const EDUARDA = 'u-eduarda';
  const RAFAEL = 'u-rafael';
  const NATAL = 'cp-natal';
  const meta = { representanteId: EDUARDA, inicio: '2026-10-01', fim: '2026-10-31', campanhaId: null };

  /** O único cliente destas visitas no realizado, com o que contou. */
  function doceMel(visitas: number, vendas: number) {
    return { id: 'c-doce-mel', nomeFantasia: 'Doce Mel', visitas, vendas };
  }

  function visita(overrides: Partial<Parameters<typeof realizadoDaMeta>[0][number]> = {}) {
    return {
      dataHora: new Date('2026-10-15T14:00:00.000-03:00'),
      userId: EDUARDA,
      clientId: 'c-doce-mel',
      clienteNome: 'Doce Mel',
      resultado: 'VENDA' as const,
      campanhaId: null,
      totalPedido: 100,
      ...overrides,
    };
  }

  it('sem visitas, zero visitas e zero vendas', () => {
    expect(realizadoDaMeta([], meta)).toEqual({ visitas: 0, vendas: 0, clientes: [] });
  });

  it('visita às 23:30 de São Paulo do dia do fim conta', () => {
    const tarde = visita({ dataHora: new Date('2026-10-31T23:30:00.000-03:00') });

    expect(realizadoDaMeta([tarde], meta)).toEqual({ visitas: 1, vendas: 100, clientes: [doceMel(1, 100)] });
  });

  it('visita às 00:10 de São Paulo do dia seguinte ao fim não conta (já é 03:10 UTC do dia 1º)', () => {
    const madrugada = visita({ dataHora: new Date('2026-11-01T00:10:00.000-03:00') });

    expect(realizadoDaMeta([madrugada], meta)).toEqual({ visitas: 0, vendas: 0, clientes: [] });
  });

  it('o dia do início conta desde 00:00 de São Paulo; a véspera às 23:59 não', () => {
    const inicio = visita({ dataHora: new Date('2026-10-01T00:00:00.000-03:00') });
    const vespera = visita({ dataHora: new Date('2026-09-30T23:59:00.000-03:00') });

    expect(realizadoDaMeta([inicio, vespera], meta)).toEqual({ visitas: 1, vendas: 100, clientes: [doceMel(1, 100)] });
  });

  it('visita de outro autor não conta', () => {
    expect(realizadoDaMeta([visita({ userId: RAFAEL })], meta)).toEqual({ visitas: 0, vendas: 0, clientes: [] });
  });

  it('meta de campanha: só as visitas daquela campanha contam', () => {
    const metaDoNatal = { ...meta, campanhaId: NATAL };
    const doNatal = visita({ campanhaId: NATAL, totalPedido: 420 });
    const semCampanha = visita({ campanhaId: null, totalPedido: 50 });
    const deOutra = visita({ campanhaId: 'cp-pascoa', totalPedido: 70 });

    expect(realizadoDaMeta([doNatal, semCampanha, deOutra], metaDoNatal)).toEqual({
      visitas: 1,
      vendas: 420,
      clientes: [doceMel(1, 420)],
    });
  });

  it('meta sem campanha: visitas com e sem campanha contam', () => {
    const doNatal = visita({ campanhaId: NATAL, totalPedido: 420 });
    const semCampanha = visita({ totalPedido: 50 });

    expect(realizadoDaMeta([doNatal, semCampanha], meta)).toEqual({ visitas: 2, vendas: 470, clientes: [doceMel(2, 470)] });
  });

  it('as vendas somam só as visitas com VENDA; todas contam como visita', () => {
    const venda = visita({ totalPedido: 503.7 });
    const negociacao = visita({ resultado: 'NEGOCIACAO', totalPedido: 0 });
    const semVenda = visita({ resultado: 'SEM_VENDA', totalPedido: 0 });

    expect(realizadoDaMeta([venda, negociacao, semVenda], meta)).toEqual({
      visitas: 3,
      vendas: 503.7,
      clientes: [doceMel(3, 503.7)],
    });
  });

  it('soma em Decimal: 3 × 27,90 + 0,10 dá 83,80 exatos (em ponto flutuante daria 83,79999…)', () => {
    const pedidos = [27.9, 27.9, 27.9, 0.1].map((totalPedido) => visita({ totalPedido }));
    const emDecimal = [new Prisma.Decimal('0.1'), new Prisma.Decimal('0.2')].map((totalPedido) =>
      visita({ totalPedido }),
    );

    expect(realizadoDaMeta(pedidos, meta).vendas).toBe(83.8);
    expect(realizadoDaMeta(emDecimal, meta).vendas).toBe(0.3);
  });
});

describe('realizadoDaMeta: clientes', () => {
  const EDUARDA = 'u-eduarda';
  const meta = { representanteId: EDUARDA, inicio: '2026-10-01', fim: '2026-10-31', campanhaId: null };

  function visita(
    clientId: string,
    clienteNome: string,
    resultado: 'VENDA' | 'NEGOCIACAO' | 'SEM_VENDA',
    totalPedido: Prisma.Decimal.Value = 0,
  ) {
    return {
      dataHora: new Date('2026-10-15T14:00:00.000-03:00'),
      userId: EDUARDA,
      clientId,
      clienteNome,
      resultado,
      campanhaId: null,
      totalPedido,
    };
  }

  it('cliente com 2 visitas e 1 venda de R$ 30 → { visitas: 2, vendas: 30 }', () => {
    const resultado = realizadoDaMeta(
      [visita('c1', 'Doce Mel', 'VENDA', 30), visita('c1', 'Doce Mel', 'SEM_VENDA')],
      meta,
    );

    expect(resultado.clientes).toEqual([{ id: 'c1', nomeFantasia: 'Doce Mel', visitas: 2, vendas: 30 }]);
  });

  it('ordena por vendas desc, depois visitas desc, depois nome', () => {
    const resultado = realizadoDaMeta(
      [
        visita('c1', 'Zeca Doces', 'VENDA', 50),
        visita('c2', 'Café Central', 'VENDA', 80),
        visita('c3', 'Mercado Sul', 'NEGOCIACAO'),
        visita('c3', 'Mercado Sul', 'SEM_VENDA'),
        visita('c4', 'Açaí Bom', 'NEGOCIACAO'),
        visita('c5', 'Bom Gosto', 'NEGOCIACAO'),
      ],
      meta,
    );

    expect(resultado.clientes.map((cliente) => cliente.nomeFantasia)).toEqual([
      'Café Central',
      'Zeca Doces',
      'Mercado Sul',
      'Açaí Bom',
      'Bom Gosto',
    ]);
  });

  it('só entram os clientes das visitas que contam na meta; as vendas somam em Decimal', () => {
    const outroAutor = { ...visita('c9', 'Outro', 'VENDA', 10), userId: 'u-rafael' };
    const foraDoPeriodo = { ...visita('c8', 'Fora', 'VENDA', 10), dataHora: new Date('2026-11-02T10:00:00.000-03:00') };
    const resultado = realizadoDaMeta(
      [
        visita('c1', 'Doce Mel', 'VENDA', 0.1),
        visita('c1', 'Doce Mel', 'VENDA', new Prisma.Decimal('0.2')),
        outroAutor,
        foraDoPeriodo,
      ],
      meta,
    );

    expect(resultado.clientes).toEqual([{ id: 'c1', nomeFantasia: 'Doce Mel', visitas: 2, vendas: 0.3 }]);
  });
});

describe('metaDentroDaCampanha (spec 7.8)', () => {
  const natal = { inicio: '2026-11-01', fim: '2026-12-24' };

  it('o período inteiro da campanha cabe', () => {
    expect(metaDentroDaCampanha({ inicio: '2026-11-01', fim: '2026-12-24' }, natal)).toBe(true);
  });

  it('um trecho no meio cabe', () => {
    expect(metaDentroDaCampanha({ inicio: '2026-11-10', fim: '2026-11-20' }, natal)).toBe(true);
  });

  it('começar antes do início não cabe', () => {
    expect(metaDentroDaCampanha({ inicio: '2026-10-31', fim: '2026-11-20' }, natal)).toBe(false);
  });

  it('terminar depois do fim não cabe', () => {
    expect(metaDentroDaCampanha({ inicio: '2026-11-10', fim: '2026-12-25' }, natal)).toBe(false);
  });
});
