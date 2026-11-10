/**
 * Botão central da barra inferior do representante (spec 2026-11-06, §3 B):
 * o `BotaoCentral` com o "+" e o rótulo "Check-in". O nome acessível é
 * "Novo check-in" (contém o rótulo visível). O toque abre o
 * `SeletorDeClienteParaCheckIn`; ao fechar sem escolher, o foco volta ao
 * botão (`useDevolverFoco`). A carteira só é buscada quando o painel abre.
 */
import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useDevolverFoco } from '@/lib/useFoco';
import { BotaoCentral } from './BotaoCentral';
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
      <BotaoCentral
        ref={ref}
        rotulo="Check-in"
        ariaLabel="Novo check-in"
        icone={Plus}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        onClick={() => setAberto(true)}
      />
      {aberto && <SeletorDeClienteParaCheckIn representanteId={representanteId} aoFechar={fechar} />}
    </>
  );
}
