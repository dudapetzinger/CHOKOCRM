import type { ReactNode } from 'react';
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Check,
  FileText,
  Inbox,
  MessageCircle,
  MousePointerClick,
  PartyPopper,
  Repeat,
  User,
  type LucideIcon,
} from 'lucide-react';

/** Ícones (lucide) dos estados vazios, pelo nome que as telas já usavam. */
const ICONES = {
  'bar-chart': BarChart3,
  calendar: CalendarDays,
  'calendar-check': CalendarCheck,
  check: Check,
  'file-text': FileText,
  inbox: Inbox,
  'message-circle': MessageCircle,
  'mouse-pointer-click': MousePointerClick,
  'party-popper': PartyPopper,
  repeat: Repeat,
  user: User,
} satisfies Record<string, LucideIcon>;

export type IconeVazio = keyof typeof ICONES;

/**
 * Estado vazio de listas e cartões (Etapa 8, visual do protótipo): ícone
 * decorativo à frente de uma frase curta, numa caixa tracejada.
 */
export function EstadoVazio({ icone, children }: { icone: IconeVazio; children: ReactNode }) {
  const Simbolo = ICONES[icone];
  return (
    <p className="flex items-center gap-3 rounded-lg border border-dashed bg-muted px-4 py-3 text-sm text-muted-foreground">
      <Simbolo aria-hidden="true" className="size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
