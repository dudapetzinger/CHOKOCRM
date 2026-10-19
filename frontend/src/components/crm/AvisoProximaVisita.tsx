/**
 * Aviso da próxima visita na ficha do cliente (spec 7.2 e 7.4; aviso de
 * `crm/ficha.tsx` do protótipo), logo abaixo do cabeçalho: "Próxima visita:
 * dd/mm/aaaa" quando há data marcada no check-in, a etiqueta da campanha da
 * próxima visita (spec 7.7) e "Lembrete: …" quando há lembrete. Sem data
 * marcada (a agenda segue a recorrência — por exemplo, depois de a
 * recorrência mudar, que apaga a data e mantém o lembrete e a campanha),
 * mostra o que houver. Sem nada disso, não desenha nada: quem usa pode
 * sempre passar os três.
 *
 * Texto marrom sobre o laranja suave (9,6:1, spec 6.3); o ícone é decorativo
 * e usa o laranja vivo do protótipo.
 */
import { CalendarClock } from 'lucide-react';
import { formatarDataCalendario } from '@/lib/formatarData';
import { EtiquetaCampanha } from './EtiquetaCampanha';

type Props = {
  /** Data marcada no check-in (`AAAA-MM-DD`); `null` quando a agenda segue a recorrência. */
  data: string | null;
  lembrete: string | null;
  /** Nome da campanha da próxima visita (spec 7.7). */
  campanha?: string | null;
};

export function AvisoProximaVisita({ data, lembrete, campanha }: Props) {
  if (!data && !lembrete && !campanha) return null;

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-brown"
    >
      <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-vivo" />
      <div className="min-w-0 space-y-1 break-words">
        {(data || campanha) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {data && (
              <span>
                <b className="font-semibold">Próxima visita:</b> {formatarDataCalendario(data)}
              </span>
            )}
            {campanha && <EtiquetaCampanha nome={campanha} />}
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
