import { Prisma } from '@prisma/client';
import { resultadosDaCampanha, statusDaCampanha } from '../../src/services/campaign.regras';

describe('statusDaCampanha (início e fim inclusivos, spec 7.7)', () => {
  const natal = { inicio: '2026-11-01', fim: '2026-12-24' };

  it('programada antes do início', () => {
    expect(statusDaCampanha(natal, '2026-10-31')).toBe('PROGRAMADA');
  });

  it('em andamento no dia do início', () => {
    expect(statusDaCampanha(natal, '2026-11-01')).toBe('EM_ANDAMENTO');
  });

  it('em andamento no meio do período', () => {
    expect(statusDaCampanha(natal, '2026-12-01')).toBe('EM_ANDAMENTO');
  });

  it('em andamento no dia do fim', () => {
    expect(statusDaCampanha(natal, '2026-12-24')).toBe('EM_ANDAMENTO');
  });

  it('encerrada no dia seguinte ao fim', () => {
    expect(statusDaCampanha(natal, '2026-12-25')).toBe('ENCERRADA');
  });

  it('evento de um dia só: em andamento só naquele dia', () => {
    const feira = { inicio: '2026-11-14', fim: '2026-11-14' };

    expect(statusDaCampanha(feira, '2026-11-13')).toBe('PROGRAMADA');
    expect(statusDaCampanha(feira, '2026-11-14')).toBe('EM_ANDAMENTO');
    expect(statusDaCampanha(feira, '2026-11-15')).toBe('ENCERRADA');
  });

  it('compara datas de calendário, não texto solto: virada de mês e de ano', () => {
    const virada = { inicio: '2026-12-31', fim: '2027-01-02' };

    expect(statusDaCampanha(virada, '2026-12-30')).toBe('PROGRAMADA');
    expect(statusDaCampanha(virada, '2027-01-01')).toBe('EM_ANDAMENTO');
    expect(statusDaCampanha(virada, '2027-01-03')).toBe('ENCERRADA');
  });
});

describe('resultadosDaCampanha (vendas e visitas vinculadas por representante)', () => {
  const EDUARDA = { id: 'r1', nome: 'Eduarda Fischer' };
  const RAFAEL = { id: 'r2', nome: 'Rafael Schmitt' };
  const ANA_INATIVA = { id: 'r3', nome: 'Ana Souza' };

  function item(quantidade: number, preco: string) {
    return { quantidade, precoUnitario: new Prisma.Decimal(preco) };
  }

  it('soma os pedidos das visitas com venda e conta todas as visitas, por autor', () => {
    const resultados = resultadosDaCampanha(
      [
        { autor: EDUARDA, resultado: 'VENDA', itens: [item(10, '42'), item(3, '27.9')] },
        { autor: EDUARDA, resultado: 'NEGOCIACAO', itens: [] },
        { autor: RAFAEL, resultado: 'VENDA', itens: [item(2, '18')] },
      ],
      [EDUARDA, RAFAEL],
    );

    expect(resultados).toEqual([
      { representante: EDUARDA, vendas: 503.7, visitas: 2 },
      { representante: RAFAEL, vendas: 36, visitas: 1 },
    ]);
  });

  it('soma em Decimal: 3 × 27,90 dá 83,70, não 83,6999…', () => {
    const [linha] = resultadosDaCampanha(
      [
        { autor: EDUARDA, resultado: 'VENDA', itens: [item(3, '27.9')] },
        { autor: EDUARDA, resultado: 'VENDA', itens: [item(1, '0.1'), item(1, '0.2')] },
      ],
      [EDUARDA],
    );

    expect(linha!.vendas).toBe(84);
  });

  it('pedido de visita que não é venda não entra nas vendas (a visita conta)', () => {
    const [linha] = resultadosDaCampanha(
      [{ autor: EDUARDA, resultado: 'SEM_VENDA', itens: [item(5, '10')] }],
      [EDUARDA],
    );

    expect(linha).toEqual({ representante: EDUARDA, vendas: 0, visitas: 1 });
  });

  it('representante sem visita vinculada aparece com zero', () => {
    const resultados = resultadosDaCampanha([], [RAFAEL, EDUARDA]);

    expect(resultados).toEqual([
      { representante: EDUARDA, vendas: 0, visitas: 0 },
      { representante: RAFAEL, vendas: 0, visitas: 0 },
    ]);
  });

  it('autor fora da lista base (ex.: inativado) aparece se tem visita vinculada; a lista sai por nome', () => {
    const resultados = resultadosDaCampanha(
      [{ autor: ANA_INATIVA, resultado: 'VENDA', itens: [item(1, '48')] }],
      [RAFAEL, EDUARDA],
    );

    expect(resultados.map((linha) => linha.representante.nome)).toEqual([
      'Ana Souza',
      'Eduarda Fischer',
      'Rafael Schmitt',
    ]);
    expect(resultados[0]).toEqual({ representante: ANA_INATIVA, vendas: 48, visitas: 1 });
  });
});
