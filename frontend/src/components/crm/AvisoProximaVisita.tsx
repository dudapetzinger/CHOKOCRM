/**
 * Aviso da próxima visita na ficha do cliente (spec 7.2 e 7.4; aviso de
 * `crm/ficha.tsx` do protótipo), logo abaixo do cabeçalho: "Próxima visita:
 * dd/mm/aaaa" quando há data marcada no check-in e "Lembrete: …" quando há
 * lembrete. Sem data marcada (a agenda segue a recorrência — por exemplo,
 * depois de a recorrência mudar, que apaga a data e mantém o lembrete), só o
 * lembrete. Quem usa decide se mostra: com data ou com lembrete.
 *
 * Texto marrom sobre o laranja suave (9,6:1, spec 6.3); o ícone é decorativo
 * e usa o laranja vivo do protótipo.
 */
import { CalendarClock } from 'lucide-react';
import { formatarDataCalendario } from '@/lib/formatarData';

type Props = {
  /** Data marcada no check-in (`AAAA-MM-DD`); `null` quando só há lembrete. */
  data: string | null;
  lembrete: string | null;
  /**
   * Nome da campanha da próxima visita (spec 7.7). Ainda não exibido: o app
   * ainda não tem campanhas.
   */
  campanha?: string | null;
};

export function AvisoProximaVisita({ data, lembrete }: Props) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-brown"
    >
      <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-vivo" />
      <div className="min-w-0 space-y-1 break-words">
        {data && (
          <p>
            <b className="font-semibold">Próxima visita:</b> {formatarDataCalendario(data)}
          </p>
        )}
        {lembrete && (
          <p>
            <b className="font-semibold">Lembrete:</b> {lembrete}
          </p>
        )}
      </div>
    </div>
  );
}
