/**
 * Barra de ferramentas (Etapa 8, spec 5.6): os controles de uma lista lado a
 * lado, numa linha compacta acima dela — select de representante, busca,
 * legenda, ação principal. Só layout: quem usa decide o que vai dentro. Se
 * não couberem, os controles quebram linha (celular e tablet), nunca rolam
 * na horizontal (ver .barra-ferramentas em styles/global.css, seção 9).
 */
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

export function BarraDeFerramentas({ children, className }: Props) {
  return <div className={className ? `barra-ferramentas ${className}` : 'barra-ferramentas'}>{children}</div>;
}
