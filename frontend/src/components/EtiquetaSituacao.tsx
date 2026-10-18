/**
 * Etiqueta de situação do cliente (Etapa 7, spec 5.1), no visual do
 * `StatusTag` do protótipo (Etapa 8): pílula com o fundo suave da cor da
 * classificação, um ponto decorativo e o texto pronto de
 * lib/descreverSituacao.ts. Ocupa só a largura do texto (também numa coluna
 * flex) e, se não couber, quebra linha em vez de estourar a tela.
 */
import { cn } from '@/lib/utils';
import type { Cor } from '../services/clients';
import { CLASSES_COR } from './crm/ui';

type Props = {
  cor: Cor;
  texto: string;
};

export function EtiquetaSituacao({ cor, texto }: Props) {
  const classes = CLASSES_COR[cor];
  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        classes.fundo,
        classes.texto,
      )}
    >
      <span aria-hidden="true" className={cn('inline-block size-1.5 shrink-0 rounded-full', classes.ponto)} />
      {texto}
    </span>
  );
}
