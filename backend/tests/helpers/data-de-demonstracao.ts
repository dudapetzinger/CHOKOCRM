/**
 * Importado como PRIMEIRO import de um arquivo de teste, liga o relógio de
 * demonstração (`DATA_DE_DEMONSTRACAO`) antes de `config/env.ts` e
 * `lib/relogio.ts` serem carregados. `tests/setup-env.ts` deixa a variável
 * vazia (relógio real) para todos os arquivos; como o Jest dá a cada arquivo
 * de teste o próprio registro de módulos, a data simulada vale só para o
 * arquivo que importa este helper — mesmo padrão de `provedor-importado.ts`.
 * O deslocamento é calculado na carga de `lib/relogio.ts`, contra o relógio
 * real; quem precisa do número esperado usa `deslocamentoEsperado()`.
 */
import { dataCalendario, diasEntre } from '../../src/services/classificacao.service';

export const DATA_SIMULADA = '2027-03-15';

process.env.DATA_DE_DEMONSTRACAO = DATA_SIMULADA;

/** Dias entre o dia real de hoje em São Paulo e `DATA_SIMULADA` (o que `lib/relogio.ts` calculou). */
export function deslocamentoEsperado(): number {
  return diasEntre(dataCalendario(new Date()), DATA_SIMULADA);
}
