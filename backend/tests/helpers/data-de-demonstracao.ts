/**
 * Liga e desliga o modo demonstração nos testes de integração, pelo mesmo
 * caminho do app: `definirDemonstracao` (`lib/relogio.ts`) grava a linha
 * `demonstracao` da tabela `configuracoes`, com o dia real de hoje (o do
 * relógio falso, se fixado) como referência, e atualiza o cache do relógio.
 *
 * `truncateAllTables()` (`helpers/db.ts`) esvazia `configuracoes` e recarrega
 * o relógio (volta ao real); quem precisa da data simulada a liga DEPOIS de
 * truncar, a cada `beforeEach`/`beforeAll` que trunca.
 */
import { definirDemonstracao } from '../../src/lib/relogio';
import { dataCalendario, diasEntre } from '../../src/services/classificacao.service';

export const DATA_SIMULADA = '2027-03-15';

export async function ativarDataDeDemonstracao(data: string = DATA_SIMULADA): Promise<void> {
  await definirDemonstracao(data);
}

export async function desativarDataDeDemonstracao(): Promise<void> {
  await definirDemonstracao(null);
}

/** Dias entre o dia real de hoje em São Paulo e `data` (o que `lib/relogio.ts` calcula ao ativar hoje). */
export function deslocamentoEsperado(data: string = DATA_SIMULADA): number {
  return diasEntre(dataCalendario(new Date()), data);
}
