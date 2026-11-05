import { decidirVinculo } from '../../src/services/importacao-nf/vinculo.regras';

describe('decidirVinculo', () => {
  const nota = { dataEmissao: '2026-11-04' };

  it('vincula sozinha quando a última visita é do mesmo dia (calendário de São Paulo)', () => {
    // 23:30 em São Paulo ainda é dia 04, embora já seja dia 05 em UTC.
    const visita = { id: 'v1', dataHora: new Date('2026-11-05T02:30:00.000Z'), resultado: 'NEGOCIACAO' as const };
    expect(decidirVinculo(nota, visita)).toEqual({ status: 'AUTOMATICO', visitaSugeridaId: 'v1' });
  });

  it('deixa pendente, com a visita sugerida, quando o dia é outro', () => {
    const visita = { id: 'v2', dataHora: new Date('2026-11-03T15:00:00.000Z'), resultado: 'VENDA' as const };
    expect(decidirVinculo(nota, visita)).toEqual({ status: 'PENDENTE', visitaSugeridaId: 'v2' });
  });

  it('não tem o que vincular quando o cliente nunca teve visita', () => {
    expect(decidirVinculo(nota, null)).toEqual({ status: 'SEM_VISITA', visitaSugeridaId: null });
  });
});
