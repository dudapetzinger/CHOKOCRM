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
 * dd/mm" (próximos dias). A data prevista é a marcada no check-in ou a da
 * recorrência; `diasAtraso` vem do backend (positivo atrasada, 0 hoje,
 * negativo adiante). O lembrete não entra aqui: tem data própria e a própria
 * linha (`descreverPrazoDoLembrete`).
 */
export function descreverPrazoDaVisita(item: { diasAtraso: number; proximaVisita: string }): string {
  if (item.diasAtraso > 0) {
    return `Visita prevista venceu há ${item.diasAtraso} ${item.diasAtraso === 1 ? 'dia' : 'dias'}`;
  }
  return item.diasAtraso === 0 ? 'Visita prevista para hoje' : `Prevista para ${formatarDiaMes(item.proximaVisita)}`;
}

/**
 * Prazo de um lembrete pela data dele (`AAAA-MM-DD`): "para hoje", "venceu há
 * N dias (dd/mm)" ou "para dd/mm". Em minúscula, para vir depois de
 * "Lembrete" ou de " · "; `diasAtraso` como em `descreverPrazoDaVisita`.
 */
export function descreverPrazoDoLembrete(diasAtraso: number, data: string): string {
  if (diasAtraso > 0) {
    return `venceu há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} (${formatarDiaMes(data)})`;
  }
  return diasAtraso === 0 ? 'para hoje' : `para ${formatarDiaMes(data)}`;
}
