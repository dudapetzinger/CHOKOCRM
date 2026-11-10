/**
 * Faixa "Modo demonstração · dd/mm/aaaa", acima do conteúdo em todas as telas
 * autenticadas enquanto o modo demonstração está ligado no backend (data na
 * tabela `configuracoes`, `GET /sistema/relogio`), para ninguém confundir a
 * demonstração com a data real. Amarelo suave com borda amarela forte e o texto marrom, como o
 * lembrete do calendário; `role="status"`, como as faixas do PWA.
 */
import { CalendarClock } from 'lucide-react';
import { formatarDataCalendario } from '@/lib/formatarData';

export function FaixaDataSimulada({
  simulado,
  dataDeDemonstracao,
}: {
  simulado: boolean;
  dataDeDemonstracao: string | null;
}) {
  if (!simulado || !dataDeDemonstracao) return null;
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 border-b border-st-yellow-forte bg-st-yellow-soft px-4 py-1.5 text-sm font-medium text-brown print:hidden"
    >
      <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
      Modo demonstração · {formatarDataCalendario(dataDeDemonstracao)}
    </p>
  );
}
