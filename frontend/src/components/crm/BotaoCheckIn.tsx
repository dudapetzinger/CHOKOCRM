/**
 * Botão central da barra inferior do representante (spec 2026-11-06, §3 B):
 * círculo de 56 px na cor primária com o "+", elevado acima da barra, e o
 * rótulo "Check-in" embaixo no estilo dos atalhos. O nome acessível é
 * "Novo check-in" (contém o rótulo visível). O toque abre o
 * `SeletorDeClienteParaCheckIn`; ao fechar sem escolher, o foco volta ao
 * botão (`useDevolverFoco`). A carteira só é buscada quando o painel abre.
 */
import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDevolverFoco } from '@/lib/useFoco';
import { SeletorDeClienteParaCheckIn } from './SeletorDeClienteParaCheckIn';

export function BotaoCheckIn({ representanteId }: { representanteId: string }) {
  const [aberto, setAberto] = useState(false);
  const { ref, devolverFoco } = useDevolverFoco<HTMLButtonElement>(aberto);

  const fechar = useCallback(
    ({ devolverFoco: devolver }: { devolverFoco: boolean }) => {
      if (devolver) devolverFoco();
      setAberto(false);
    },
    [devolverFoco],
  );

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Novo check-in"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => setAberto(true)}
        className="group -mt-6 flex flex-col items-center gap-0.5 rounded-lg px-2 pb-2 text-xs font-medium text-muted-foreground focus-visible:outline-none"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card transition-colors group-hover:bg-primary-hover group-focus-visible:ring-ring">
          <Plus aria-hidden="true" className="size-7" strokeWidth={2.5} />
        </span>
        Check-in
      </button>
      {aberto && <SeletorDeClienteParaCheckIn representanteId={representanteId} aoFechar={fechar} />}
    </>
  );
}
