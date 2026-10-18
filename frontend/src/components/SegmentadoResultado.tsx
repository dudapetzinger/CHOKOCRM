/**
 * Controle segmentado do resultado da visita no check-in (UC07): três
 * opções lado a lado em vez de um `<select>`, para escolher com um toque.
 * Segue o padrão `radiogroup`: só a opção marcada entra no Tab e as setas
 * trocam a seleção. Desde a Etapa 8 é o `Segmentado` genérico (visual do
 * `Segmented` do protótipo, 44 px por opção no celular) com as três opções
 * fixas, numa linha só e na largura toda no celular.
 */
import type { ResultadoVisita } from '../services/visits';
import { Segmentado, type Opcao } from './Segmentado';

const OPCOES: readonly Opcao<ResultadoVisita>[] = [
  { valor: 'VENDA', rotulo: 'Venda' },
  { valor: 'NEGOCIACAO', rotulo: 'Negociação' },
  { valor: 'SEM_VENDA', rotulo: 'Sem venda' },
];

type Props = {
  valor: ResultadoVisita;
  onChange: (resultado: ResultadoVisita) => void;
  /** Nome acessível do grupo. */
  rotulo?: string;
};

export function SegmentadoResultado({ valor, onChange, rotulo = 'Resultado da visita' }: Props) {
  return <Segmentado ariaLabel={rotulo} opcoes={OPCOES} valor={valor} onChange={onChange} larguraTotal />;
}
