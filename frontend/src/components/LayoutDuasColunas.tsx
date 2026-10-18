/**
 * Duas colunas lado a lado (Etapa 7; Tailwind na Etapa 8): Agenda (Atrasadas
 * | Hoje) e Painel, que só o usam a partir de 768 px. Abaixo de 768 as
 * colunas se empilham, a esquerda antes da direita; de 768 a 1023 dividem o
 * espaço ao meio; a partir de 1024 a esquerda tem no máximo
 * `larguraEsquerda` (variável CSS `--largura-esquerda`, mínimo de 360 px).
 * Clientes monta a própria grade (lista de 440 px | ficha, spec 7.1).
 */
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  esquerda: ReactNode;
  direita: ReactNode;
  /** Largura máxima da coluna esquerda a partir de 1024 px (mínimo de 360px). */
  larguraEsquerda?: string;
  className?: string;
};

export function LayoutDuasColunas({ esquerda, direita, larguraEsquerda = '400px', className }: Props) {
  const estilo = { '--largura-esquerda': larguraEsquerda } as CSSProperties;

  return (
    <div
      className={cn(
        'grid items-start gap-5 md:grid-cols-2 lg:grid-cols-[minmax(360px,var(--largura-esquerda))_minmax(0,1fr)]',
        className,
      )}
      style={estilo}
    >
      <div className="min-w-0">{esquerda}</div>
      <div className="min-w-0">{direita}</div>
    </div>
  );
}
