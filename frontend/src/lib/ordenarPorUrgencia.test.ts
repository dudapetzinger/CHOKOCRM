import type { Cor } from '../services/clients';
import { ordenarPorUrgencia } from './ordenarPorUrgencia';

type Item = { cor: Cor; diasSemVisita: number | null; nomeFantasia: string };

describe('ordenarPorUrgencia', () => {
  it('ordena por cor (VERMELHO → LARANJA → AMARELO → VERDE), nunca visitado, dias desc e nome', () => {
    const embaralhada: Item[] = [
      { cor: 'VERDE', diasSemVisita: 2, nomeFantasia: 'Verde B' },
      { cor: 'AMARELO', diasSemVisita: 10, nomeFantasia: 'Amarelo' },
      { cor: 'VERMELHO', diasSemVisita: 40, nomeFantasia: 'Vermelho 40' },
      { cor: 'LARANJA', diasSemVisita: 20, nomeFantasia: 'Laranja 20' },
      { cor: 'VERDE', diasSemVisita: 2, nomeFantasia: 'Verde A' },
      { cor: 'VERMELHO', diasSemVisita: null, nomeFantasia: 'Vermelho nunca' },
      { cor: 'LARANJA', diasSemVisita: 25, nomeFantasia: 'Laranja 25' },
      { cor: 'VERMELHO', diasSemVisita: 60, nomeFantasia: 'Vermelho 60' },
      { cor: 'VERDE', diasSemVisita: 9, nomeFantasia: 'Verde 9' },
    ];

    expect(ordenarPorUrgencia(embaralhada).map((item) => item.nomeFantasia)).toEqual([
      'Vermelho nunca',
      'Vermelho 60',
      'Vermelho 40',
      'Laranja 25',
      'Laranja 20',
      'Amarelo',
      'Verde 9',
      'Verde A',
      'Verde B',
    ]);
  });

  it('nunca visitado (null) vem antes de 40 dias na mesma cor', () => {
    const itens: Item[] = [
      { cor: 'VERMELHO', diasSemVisita: 40, nomeFantasia: 'A' },
      { cor: 'VERMELHO', diasSemVisita: null, nomeFantasia: 'B' },
    ];

    expect(ordenarPorUrgencia(itens).map((item) => item.nomeFantasia)).toEqual(['B', 'A']);
  });

  it('desempata por nome com localeCompare pt-BR (acentos)', () => {
    const itens: Item[] = [
      { cor: 'AMARELO', diasSemVisita: 5, nomeFantasia: 'Padaria' },
      { cor: 'AMARELO', diasSemVisita: 5, nomeFantasia: 'Árvore' },
      { cor: 'AMARELO', diasSemVisita: 5, nomeFantasia: 'Bomboniere' },
    ];

    expect(ordenarPorUrgencia(itens).map((item) => item.nomeFantasia)).toEqual([
      'Árvore',
      'Bomboniere',
      'Padaria',
    ]);
  });

  it('não altera a lista recebida', () => {
    const itens: Item[] = [
      { cor: 'VERDE', diasSemVisita: 1, nomeFantasia: 'Verde' },
      { cor: 'VERMELHO', diasSemVisita: 50, nomeFantasia: 'Vermelho' },
    ];
    const copia = [...itens];

    const ordenada = ordenarPorUrgencia(itens);

    expect(itens).toEqual(copia);
    expect(ordenada).not.toBe(itens);
  });
});
