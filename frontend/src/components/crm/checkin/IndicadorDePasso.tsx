/**
 * Topo do cartão do check-in em passos (Etapa 10b): "Passo N de 4", os
 * quatro pontos de progresso (decorativos: o texto já diz onde se está) e o
 * título do passo num `h2` focável por script (`tabIndex={-1}`), que a
 * página foca ao trocar de passo para o leitor de tela anunciar o passo novo.
 */
import { cn } from '@/lib/utils';
import type { Passo } from '@/lib/validarCheckIn';

const PASSOS: readonly Passo[] = [1, 2, 3, 4];

export function IndicadorDePasso({ passo, titulo, idTitulo }: { passo: Passo; titulo: string; idTitulo: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Passo {passo} de 4</p>
        <div aria-hidden="true" className="flex gap-1.5">
          {PASSOS.map((indice) => (
            <span
              key={indice}
              className={cn('h-1.5 w-6 rounded-full', indice <= passo ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      </div>
      <h2
        id={idTitulo}
        tabIndex={-1}
        className="rounded-sm text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {titulo}
      </h2>
    </div>
  );
}
