/**
 * Cartão "Roteiro do dia" (spec 7.9; visual de `Roteiro` em
 * `routes/agenda.tsx` do protótipo), acima das seções da Agenda do dia:
 * "N paradas · cerca de X km", chips "1 Nome · Cidade" ligados por
 * "→ 12 km →" (ou "→ mesma cidade →") e "Abrir no Google Maps" em nova aba
 * (no celular, abre o app). O Google Maps do celular aceita só 3 paradas
 * intermediárias por link; por isso o roteiro vira trechos de até 5 paradas,
 * um botão por trecho ("Trecho 1 de 3"), e a parada que fecha um trecho abre o
 * seguinte (ela traz "fim do trecho 1 · início do trecho 2"). As paradas são as primeiras 10 da agenda, na
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
import {
  dividirEmTrechos,
  linksGoogleMaps,
  montarRoteiro,
  type Parada,
  type ParadaNoRoteiro,
  type Trecho,
} from '../../lib/roteiro';

function descreverTrecho(parada: ParadaNoRoteiro): string {
  if (parada.mesmaCidade) return 'mesma cidade';
  return parada.kmDesdeAnterior === null ? 'distância desconhecida' : `${parada.kmDesdeAnterior} km`;
}

function descreverResumo(quantidade: number, kmTotal: number): string {
  const paradas = quantidade === 1 ? '1 parada' : `${quantidade} paradas`;
  return quantidade === 1 ? paradas : `${paradas} · cerca de ${kmTotal} km`;
}

/** Marca a parada que fecha um trecho e abre o seguinte; vazio nas demais. */
function descreverTrechos(trechos: Trecho[], indice: number): string {
  const anterior = trechos.findIndex((trecho, k) => k < trechos.length - 1 && trecho.fim === indice);
  return anterior === -1 ? '' : `fim do trecho ${anterior + 1} · início do trecho ${anterior + 2}`;
}

export function Roteiro({ paradas: recebidas }: { paradas: Parada[] }) {
  const idTitulo = useId();
  const { paradas, foraDoRoteiro, kmTotal } = montarRoteiro(recebidas);

  if (paradas.length === 0) return null;

  const links = linksGoogleMaps(paradas);
  const trechos = dividirEmTrechos(paradas.length);

  return (
    <section aria-labelledby={idTitulo} className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={idTitulo} className="text-base font-semibold">
            Roteiro do dia
          </h2>
          <p className="text-sm text-muted-foreground">{descreverResumo(paradas.length, kmTotal)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map(({ rotulo, url }) => (
            <Button key={url} size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <Navigation aria-hidden="true" />
                Abrir no Google Maps{rotulo && ` — ${rotulo}`}
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          ))}
        </div>
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
            {descreverTrechos(trechos, indice) && (
              <span className="text-xs text-muted-foreground">{descreverTrechos(trechos, indice)}</span>
            )}
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
