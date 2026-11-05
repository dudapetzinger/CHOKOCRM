/**
 * Aviso da fonte de vendas do ERP (Etapa 12b), no lugar do antigo
 * `AvisoSimulado`: lê `GET /erp/situacao` e diz de onde vêm os números.
 * Provedor simulado: "Dados simulados — ..."; importado: "Vendas do ERP
 * importadas até dd/mm/aaaa" (data da venda mais recente) ou "Nenhuma nota
 * importada ainda.". Sem a situação (carregando ou falha), não mostra nada.
 * Compartilhado pelo card "Dados do ERP" (UC11), pelo card de insights (UC13)
 * e pelo Painel (UC15). Visual do `SimBanner` do protótipo: faixa tracejada
 * discreta. Por padrão deixa 16 px de respiro embaixo (dentro dos cartões);
 * `className` troca essa regra de layout (o Painel, numa pilha com `gap`).
 */
import { cn } from '@/lib/utils';
import { formatarDataCalendario } from '../lib/formatarData';
import { useSituacaoErp } from '../hooks/useImportacoes';
import type { SituacaoErp } from '../services/erp';

function textoDaSituacao(situacao: SituacaoErp): string {
  if (situacao.simulado) return 'Dados simulados — integração com o ERP ainda não está disponível';
  if (situacao.ultimaVendaEm) return `Vendas do ERP importadas até ${formatarDataCalendario(situacao.ultimaVendaEm)}`;
  return 'Nenhuma nota importada ainda.';
}

export function AvisoErp({ className = 'mb-4' }: { className?: string }) {
  const { data: situacao } = useSituacaoErp();
  if (!situacao) return null;

  return (
    <p className={cn('rounded-md border border-dashed bg-muted px-3 py-1.5 text-xs text-muted-foreground', className)}>
      {textoDaSituacao(situacao)}
    </p>
  );
}
