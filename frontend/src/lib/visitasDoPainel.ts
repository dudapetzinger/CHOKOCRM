/** Ordem e soma das visitas do período que os painéis laterais mostram. */
import type { VisitaDoPeriodo } from '../services/kpis';

/** Da mais recente para a mais antiga (instantes ISO UTC ordenam como texto). */
export function maisRecentesPrimeiro(visitas: VisitaDoPeriodo[]): VisitaDoPeriodo[] {
  return [...visitas].sort((a, b) => b.dataHora.localeCompare(a.dataHora));
}

/** A soma de `valor` em reais, em centavos inteiros para não acumular erro de ponto flutuante. */
export function somarValores(visitas: VisitaDoPeriodo[]): number {
  return visitas.reduce((soma, { valor }) => soma + Math.round(valor * 100), 0) / 100;
}
