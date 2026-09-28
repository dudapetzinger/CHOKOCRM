import type { SeasonalEvent } from '@prisma/client';
import { escolherVigente } from '../../src/services/seasonal-event.service';

function eventoFabricado(overrides: Partial<SeasonalEvent> & { id: string; dataFim: Date }): SeasonalEvent {
  return {
    nome: 'Evento Teste',
    dataInicio: new Date('2026-01-01T12:00:00Z'),
    produtosSugeridos: [],
    ...overrides,
  } as SeasonalEvent;
}

describe('escolherVigente', () => {
  it('sem candidatos devolve null', () => {
    expect(escolherVigente([])).toBeNull();
  });

  it('um candidato devolve ele', () => {
    const evento = eventoFabricado({ id: 'a', dataFim: new Date('2026-04-05T12:00:00Z') });

    expect(escolherVigente([evento])).toEqual({
      id: 'a',
      nome: 'Evento Teste',
      produtosSugeridos: [],
      dataFim: evento.dataFim,
    });
  });

  it('dois candidatos: escolhe o de dataFim mais próxima', () => {
    const maisProximo = eventoFabricado({ id: 'proximo', dataFim: new Date('2026-04-05T12:00:00Z') });
    const maisDistante = eventoFabricado({ id: 'distante', dataFim: new Date('2026-05-10T12:00:00Z') });

    const resultado = escolherVigente([maisDistante, maisProximo]);

    expect(resultado?.id).toBe('proximo');
  });
});
