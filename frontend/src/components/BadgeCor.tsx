/**
 * Selo de classificação por cor do cliente (UC05, Etapa 4): o ponto de 10 px
 * do protótipo (`Dot` de `crm/ui.tsx`, Etapa 8), com a cor de
 * `CLASSES_COR`. O rótulo textual fica só no `aria-label`, para leitores de
 * tela; a etiqueta de situação ao lado diz o mesmo em palavras.
 */
import { cn } from '@/lib/utils';
import { ROTULO_COR, type Cor } from '../services/clients';
import { CLASSES_COR } from './crm/ui';

type Props = {
  cor: Cor;
  className?: string;
};

export function BadgeCor({ cor, className }: Props) {
  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', CLASSES_COR[cor].ponto, className)}
      role="img"
      aria-label={`Classificação: ${ROTULO_COR[cor]}`}
    />
  );
}
