/**
 * Regra pura do vínculo da nota importada com a visita, no calendário de São
 * Paulo. A candidata é a visita mais recente do cliente, sem nota ligada, com
 * dia entre 15 dias antes da nota (`DIAS_DA_JANELA_DO_VINCULO`) e o dia da
 * nota. Visita posterior à nota nunca é candidata. Candidata do mesmo dia
 * vincula sozinha; de 1 a 15 dias antes deixa a nota pendente; sem candidata a
 * nota fica só como compra (`SEM_VISITA`). Quem chama entrega só visitas sem
 * nota ligada (`visita-candidata.ts`).
 */
import { type DataCalendario, dataCalendario, diasEntre, somarDias } from '../classificacao.service';

export const DIAS_DA_JANELA_DO_VINCULO = 15;

export type StatusDoVinculo = 'AUTOMATICO' | 'PENDENTE' | 'SEM_VISITA';

/** A visita escolhida, o dia dela e quantos dias ela vem antes da nota (0 no mesmo dia). */
export type Candidata<V> = { visita: V; dia: DataCalendario; diasAntes: number };

/** Dias (inclusivos) em que uma visita pode ser a candidata da nota. */
export function janelaDoVinculo(diaDaNota: DataCalendario): { de: DataCalendario; ate: DataCalendario } {
  return { de: somarDias(diaDaNota, -DIAS_DA_JANELA_DO_VINCULO), ate: diaDaNota };
}

/** A visita mais recente dentro da janela da nota, ou `null`. */
export function escolherCandidata<V extends { dataHora: Date }>(
  diaDaNota: DataCalendario,
  visitas: V[],
): Candidata<V> | null {
  const maisRecentes = [...visitas].sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());
  for (const visita of maisRecentes) {
    const dia = dataCalendario(visita.dataHora);
    const diasAntes = diasEntre(dia, diaDaNota);
    if (diasAntes >= 0 && diasAntes <= DIAS_DA_JANELA_DO_VINCULO) return { visita, dia, diasAntes };
  }
  return null;
}

/** Situação da nota sem decisão da gestão, pela candidata. */
export function statusDoVinculo(candidata: { diasAntes: number } | null): StatusDoVinculo {
  if (candidata === null) return 'SEM_VISITA';
  return candidata.diasAntes === 0 ? 'AUTOMATICO' : 'PENDENTE';
}
