/**
 * Aviso de dados simulados do ERP: enquanto a integração real com a Senior não
 * existe (ADR-006), o provider mock devolve `simulado: true` e as telas que
 * mostram dados do ERP avisam o usuário. Texto único, compartilhado pelo card
 * "Dados do ERP" (UC11), pelo card de insights (UC13) e pelo Painel (UC15).
 */
export function AvisoSimulado() {
  return <p className="aviso">Dados simulados — integração com o ERP ainda não está disponível.</p>;
}
