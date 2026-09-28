/**
 * Selo de classificação por cor do cliente (UC05, Etapa 4). Ponto de 12px
 * cuja cor comunica a classificação; o rótulo textual fica só no
 * `aria-label`, para leitores de tela (ver .badge-* em styles/global.css).
 */
import { ROTULO_COR, type Cor } from '../services/clients';

type Props = {
  cor: Cor;
};

export function BadgeCor({ cor }: Props) {
  return (
    <span
      className={`badge-${cor.toLowerCase()}`}
      role="img"
      aria-label={`Classificação: ${ROTULO_COR[cor]}`}
    />
  );
}
