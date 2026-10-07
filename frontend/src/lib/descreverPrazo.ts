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
