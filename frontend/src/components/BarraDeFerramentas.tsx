/**
 * Barra de ferramentas (Etapa 8, spec 7.1): os controles de uma lista lado a
 * lado, numa linha acima dela — select de representante, busca, legenda,
 * ação principal. Só layout: quem usa decide o que vai dentro. Se não
 * couberem, os controles quebram linha (celular), nunca rolam na horizontal.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
};

export function BarraDeFerramentas({ children, className }: Props) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}
