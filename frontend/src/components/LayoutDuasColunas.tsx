/**
 * Duas colunas lado a lado a partir de 768 px (Etapa 7): Clientes (lista |
 * ficha), Agenda (Atrasadas | Hoje) e Painel. No celular as colunas se
 * empilham, a esquerda antes da direita. A largura máxima da coluna esquerda
 * vai numa variável CSS lida por `.duas-colunas` em styles/desktop.css.
 */
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  esquerda: ReactNode;
  direita: ReactNode;
  /** Largura máxima da coluna esquerda no desktop (mínimo de 360px). */
  larguraEsquerda?: string;
  className?: string;
};

export function LayoutDuasColunas({ esquerda, direita, larguraEsquerda = '400px', className }: Props) {
  const estilo = { '--largura-esquerda': larguraEsquerda } as CSSProperties;

  return (
    <div className={className ? `duas-colunas ${className}` : 'duas-colunas'} style={estilo}>
      <div className="coluna">{esquerda}</div>
      <div className="coluna">{direita}</div>
    </div>
  );
}
