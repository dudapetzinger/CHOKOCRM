/**
 * Cartão "Roteiro do dia" (spec 7.9; visual de `Roteiro` em
 * `routes/agenda.tsx` do protótipo), acima das seções da Agenda do dia:
 * "N paradas · cerca de X km", chips "1 Nome · Cidade" ligados por
 * "→ 12 km →" (ou "→ mesma cidade →") e "Abrir no Google Maps" em nova aba
 * (no celular, abre o app). As paradas são as primeiras 10 da agenda, na
 * ordem de urgência recebida (`montarRoteiro`); as demais viram "+N
 * clientes da agenda fora do roteiro". Sem paradas, não desenha nada. Quem
 * usa decide se aparece (para o gestor, só com um representante escolhido).
 *
 * Chip em `bg-primary-soft` com o número e o texto em `text-brown` (9,6:1;
 * o laranja do protótipo dava 2,7:1). As setas são decorativas: o leitor de
 * tela ouve só a distância.
 */
import { useId } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { linkGoogleMaps, montarRoteiro, type Parada, type ParadaNoRoteiro } from '../../lib/roteiro';

function descreverTrecho(parada: ParadaNoRoteiro): string {
  if (parada.mesmaCidade) return 'mesma cidade';
  return parada.kmDesdeAnterior === null ? 'distância desconhecida' : `${parada.kmDesdeAnterior} km`;
}

function descreverResumo(quantidade: number, kmTotal: number): string {
  const paradas = quantidade === 1 ? '1 parada' : `${quantidade} paradas`;
  return quantidade === 1 ? paradas : `${paradas} · cerca de ${kmTotal} km`;
}

export function Roteiro({ paradas: recebidas }: { paradas: Parada[] }) {
  const idTitulo = useId();
  const { paradas, foraDoRoteiro, kmTotal } = montarRoteiro(recebidas);

  if (paradas.length === 0) return null;

  return (
    <section aria-labelledby={idTitulo} className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={idTitulo} className="text-base font-semibold">
            Roteiro do dia
          </h2>
          <p className="text-sm text-muted-foreground">{descreverResumo(paradas.length, kmTotal)}</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <a href={linkGoogleMaps(paradas)} target="_blank" rel="noreferrer">
            <Navigation aria-hidden="true" />
            Abrir no Google Maps
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </Button>
      </div>
      <ol aria-label="Paradas" className="flex flex-wrap items-center gap-2 text-sm">
        {paradas.map((parada, indice) => (
          <li key={parada.id} className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {indice > 0 && (
              <span className="text-xs text-muted-foreground">
                <span aria-hidden="true">→ </span>
                {descreverTrecho(parada)}
                <span aria-hidden="true"> →</span>
              </span>
            )}
            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-brown">
              <b className="font-bold">{indice + 1}</b>
              <span className="min-w-0 break-words">
                {parada.nome}
                <span className="text-xs">
                  {' · '}
                  <MapPin aria-hidden="true" className="inline size-3 align-[-1px]" /> {parada.cidade}
                </span>
              </span>
            </span>
          </li>
        ))}
      </ol>
      {foraDoRoteiro > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          +{foraDoRoteiro} {foraDoRoteiro === 1 ? 'cliente da agenda fora' : 'clientes da agenda fora'} do roteiro
        </p>
      )}
    </section>
  );
}
