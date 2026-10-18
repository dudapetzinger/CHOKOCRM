/**
 * Aviso de dados simulados do ERP: enquanto a integração real com a Senior não
 * existe (ADR-006), o provider mock devolve `simulado: true` e as telas que
 * mostram dados do ERP avisam o usuário. Texto único, compartilhado pelo card
 * "Dados do ERP" (UC11), pelo card de insights (UC13) e pelo Painel (UC15).
 * Visual e texto do `SimBanner` do protótipo (Etapa 8): faixa tracejada
 * discreta. Por padrão deixa 16 px de respiro embaixo (dentro dos cartões);
 * `className` troca essa regra de layout (o Painel, numa pilha com `gap`).
 */
import { cn } from '@/lib/utils';

export function AvisoSimulado({ className = 'mb-4' }: { className?: string }) {
  return (
    <p className={cn('rounded-md border border-dashed bg-muted px-3 py-1.5 text-xs text-muted-foreground', className)}>
      Dados simulados — integração com o ERP ainda não está disponível
    </p>
  );
}
