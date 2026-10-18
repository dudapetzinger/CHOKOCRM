/**
 * Aviso de dados simulados do ERP: enquanto a integração real com a Senior não
 * existe (ADR-006), o provider mock devolve `simulado: true` e as telas que
 * mostram dados do ERP avisam o usuário. Texto único, compartilhado pelo card
 * "Dados do ERP" (UC11), pelo card de insights (UC13) e pelo Painel (UC15).
 * Visual do `SimBanner` do protótipo (Etapa 8): caixa tracejada discreta.
 */
export function AvisoSimulado() {
  return (
    <p className="mb-4 rounded-md border border-dashed bg-muted px-3 py-1.5 text-xs text-muted-foreground">
      Dados simulados — integração com o ERP ainda não está disponível.
    </p>
  );
}
