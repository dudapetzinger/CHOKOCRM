import { formatarDiaMes } from './formatarData';

/**
 * Prazo até um evento em linguagem natural: 'é hoje', 'é amanhã' ou 'em N dias'.
 * Mesma redação que o backend usa no título da sugestão (UC13), para o Painel e
 * o card de insights falarem igual.
 */
export function descreverPrazo(dias: number): string {
  if (dias === 0) return 'é hoje';
  if (dias === 1) return 'é amanhã';
  return `em ${dias} dias`;
}

/**
 * Prazo da visita prevista numa linha da agenda (spec 7.4): "Visita prevista
 * venceu há N dias" (atrasada), "Visita prevista para hoje" ou "Prevista para
 * dd/mm" (próximos dias), seguido de " · lembrete" quando há lembrete. A data
 * prevista é a marcada no check-in ou a da recorrência; `diasAtraso` vem do
 * backend (positivo atrasada, 0 hoje, negativo adiante).
 */
export function descreverPrazoDaVisita(item: { diasAtraso: number; proximaVisita: string; lembrete: string | null }): string {
  const prazo =
    item.diasAtraso > 0
      ? `Visita prevista venceu há ${item.diasAtraso} ${item.diasAtraso === 1 ? 'dia' : 'dias'}`
      : item.diasAtraso === 0
        ? 'Visita prevista para hoje'
        : `Prevista para ${formatarDiaMes(item.proximaVisita)}`;

  return item.lembrete ? `${prazo} · ${item.lembrete}` : prazo;
}
