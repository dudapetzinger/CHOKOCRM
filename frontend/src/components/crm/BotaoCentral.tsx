/**
 * Botão central da barra inferior (celular): círculo de 56 px na cor primária
 * com um ícone, elevado acima da barra, e o rótulo embaixo no estilo dos
 * atalhos. Serve ao `BotaoCheckIn` do representante e ao "Importar notas" da
 * Gestão (spec 2026-11-09, §3). O nome acessível (`ariaLabel`) deve conter o
 * rótulo visível. As propriedades de ARIA (`aria-haspopup`, `aria-expanded`) e
 * o `ref` (para devolver o foco) são repassados ao `<button>`.
 */
import type { ComponentPropsWithRef } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  rotulo: string;
  ariaLabel: string;
  icone: LucideIcon;
  onClick: () => void;
  ref?: ComponentPropsWithRef<'button'>['ref'];
  'aria-haspopup'?: 'dialog';
  'aria-expanded'?: boolean;
};

export function BotaoCentral({ rotulo, ariaLabel, icone: Icone, onClick, ref, ...aria }: Props) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      {...aria}
      onClick={onClick}
      className="group -mt-6 flex flex-col items-center gap-0.5 rounded-lg px-2 pb-2 text-xs font-medium text-muted-foreground focus-visible:outline-none"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card transition-colors group-hover:bg-primary-hover group-focus-visible:ring-ring">
        <Icone aria-hidden="true" className="size-7" strokeWidth={2.5} />
      </span>
      {rotulo}
    </button>
  );
}
