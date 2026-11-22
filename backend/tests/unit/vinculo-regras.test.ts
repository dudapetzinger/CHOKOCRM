import {
  DIAS_DA_JANELA_DO_VINCULO,
  escolherCandidata,
  janelaDoVinculo,
  statusDoVinculo,
} from '../../src/services/importacao-nf/vinculo.regras';

/** Instante às 12h de São Paulo de `dia` ('AAAA-MM-DD'). */
function meioDia(dia: string): Date {
  return new Date(`${dia}T15:00:00.000Z`);
}

describe('regra do vínculo da nota com a visita', () => {
  const diaDaNota = '2026-11-04';

  it('a janela vai de 15 dias antes da nota até o dia da nota', () => {
    expect(DIAS_DA_JANELA_DO_VINCULO).toBe(15);
    expect(janelaDoVinculo(diaDaNota)).toEqual({ de: '2026-10-20', ate: '2026-11-04' });
  });

  it('visita do mesmo dia (calendário de São Paulo) vincula sozinha', () => {
    // 23:30 em São Paulo ainda é dia 04, embora já seja dia 05 em UTC.
    const visita = { id: 'v1', dataHora: new Date('2026-11-05T02:30:00.000Z') };
    const candidata = escolherCandidata(diaDaNota, [visita]);
    expect(candidata).toEqual({ visita, dia: '2026-11-04', diasAntes: 0 });
    expect(statusDoVinculo(candidata)).toBe('AUTOMATICO');
  });

  it('visita de 1 a 15 dias antes da nota fica pendente, com quantos dias antes', () => {
    const umDia = { id: 'v2', dataHora: meioDia('2026-11-03') };
    expect(escolherCandidata(diaDaNota, [umDia])).toEqual({ visita: umDia, dia: '2026-11-03', diasAntes: 1 });
    const quinzeDias = { id: 'v3', dataHora: meioDia('2026-10-20') };
    const candidata = escolherCandidata(diaDaNota, [quinzeDias]);
    expect(candidata).toEqual({ visita: quinzeDias, dia: '2026-10-20', diasAntes: 15 });
    expect(statusDoVinculo(candidata)).toBe('PENDENTE');
  });

  it('visita a 16 dias da nota não é candidata: a nota fica só como compra', () => {
    const candidata = escolherCandidata(diaDaNota, [{ id: 'v4', dataHora: meioDia('2026-10-19') }]);
    expect(candidata).toBeNull();
    expect(statusDoVinculo(candidata)).toBe('SEM_VISITA');
  });

  it('visita posterior à nota nunca é sugerida, mesmo sendo a mais recente', () => {
    const anterior = { id: 'v5', dataHora: meioDia('2026-11-01') };
    const posterior = { id: 'v6', dataHora: meioDia('2026-11-05') };
    expect(escolherCandidata(diaDaNota, [posterior, anterior])?.visita).toBe(anterior);
    expect(escolherCandidata(diaDaNota, [posterior])).toBeNull();
  });

  it('entre as visitas da janela, a candidata é a mais recente, em qualquer ordem de entrada', () => {
    const antiga = { id: 'v7', dataHora: meioDia('2026-10-25') };
    const recente = { id: 'v8', dataHora: meioDia('2026-11-02') };
    expect(escolherCandidata(diaDaNota, [antiga, recente])?.visita).toBe(recente);
    expect(escolherCandidata(diaDaNota, [recente, antiga])?.visita).toBe(recente);
  });

  it('sem visita não há candidata', () => {
    expect(escolherCandidata(diaDaNota, [])).toBeNull();
    expect(statusDoVinculo(null)).toBe('SEM_VISITA');
  });
});
