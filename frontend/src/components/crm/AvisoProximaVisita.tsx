/**
 * Aviso da próxima visita na ficha do cliente (spec 7.2 e 7.4; aviso de
 * `crm/ficha.tsx` do protótipo), logo abaixo do cabeçalho: "Próxima visita:
 * dd/mm/aaaa" quando há data marcada no check-in e a etiqueta da campanha da
 * próxima visita (spec 7.7). Abaixo, os lembretes abertos do cliente (Etapa
 * 9: o lembrete tem data própria, independente da visita), cada um com o
 * texto, o prazo embaixo (`descreverPrazoDoLembrete`) e, com `podeConcluir`,
 * o botão "Concluir" à direita. Sem data marcada (a agenda segue a recorrência), mostra o que
 * houver; sem data, campanha nem lembrete, não desenha nada: quem usa pode
 * sempre passar tudo.
 *
 * Texto marrom sobre o laranja suave (9,6:1, spec 6.3); o ícone é decorativo
 * e usa o laranja vivo do protótipo.
 */
import { useId } from 'react';
import { CalendarClock } from 'lucide-react';
import { formatarDataCalendario } from '@/lib/formatarData';
import { descreverPrazoDoLembrete } from '@/lib/descreverPrazo';
import type { LembreteItem } from '@/services/lembretes';
import { BotaoConcluirLembrete } from '../BotaoConcluirLembrete';
import { EtiquetaCampanha } from './EtiquetaCampanha';

type Props = {
  /** Data marcada no check-in (`AAAA-MM-DD`); `null` quando a agenda segue a recorrência. */
  data: string | null;
  /** Nome da campanha da próxima visita (spec 7.7). */
  campanha?: string | null;
  /** Os lembretes abertos do cliente, por data. */
  lembretes: LembreteItem[];
  /** O dono da carteira e o gestor concluem lembretes. */
  podeConcluir: boolean;
};

export function AvisoProximaVisita({ data, campanha, lembretes, podeConcluir }: Props) {
  const idLembretes = useId();

  if (!data && !campanha && lembretes.length === 0) return null;

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-brown"
    >
      <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-vivo" />
      <div className="min-w-0 flex-1 space-y-2 break-words">
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
        {lembretes.length > 0 && (
          <div className="space-y-1">
            <p id={idLembretes} className="font-semibold">
              Lembretes
            </p>
            <ul aria-labelledby={idLembretes} className="space-y-2">
              {lembretes.map((lembrete) => (
                <li key={lembrete.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block">{lembrete.texto}</span>
                    {/* O prazo vem em minúscula (`descreverPrazoDoLembrete`); na linha própria, a inicial é maiúscula só no visual. */}
                    <span className="block text-xs first-letter:uppercase">
                      {descreverPrazoDoLembrete(lembrete.diasAtraso, lembrete.data)}
                    </span>
                  </span>
                  {podeConcluir && (
                    <BotaoConcluirLembrete lembreteId={lembrete.id} rotulo={`Concluir lembrete: ${lembrete.texto}`} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
