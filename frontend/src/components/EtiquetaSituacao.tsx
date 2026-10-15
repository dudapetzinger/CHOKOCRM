/**
 * Etiqueta de situação do cliente (Etapa 7, spec 5.1): pílula com o fundo
 * suave da cor da classificação e um texto pronto (ver
 * lib/descreverSituacao.ts e .etiqueta-situacao em styles/global.css).
 */
import type { Cor } from '../services/clients';

type Props = {
  cor: Cor;
  texto: string;
};

export function EtiquetaSituacao({ cor, texto }: Props) {
  return <span className={`etiqueta-situacao etiqueta-${cor.toLowerCase()}`}>{texto}</span>;
}
