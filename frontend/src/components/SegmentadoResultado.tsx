/**
 * Controle segmentado do resultado da visita no check-in (UC07): três
 * opções lado a lado em vez de um `<select>`, para escolher com um toque.
 * Segue o padrão `radiogroup`: só a opção marcada entra no Tab e as setas
 * trocam a seleção.
 */
import { useRef, type KeyboardEvent } from 'react';
import type { ResultadoVisita } from '../services/visits';
import { proximoIndicePorSeta } from '../lib/navegacaoSetas';

const OPCOES: { valor: ResultadoVisita; rotulo: string }[] = [
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
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const atual = OPCOES.findIndex((opcao) => opcao.valor === valor);
    const proximo = proximoIndicePorSeta(event.key, atual, OPCOES.length);
    if (proximo === null) return;
    event.preventDefault();
    onChange(OPCOES[proximo].valor);
    botoes.current[proximo]?.focus();
  }

  return (
    <div className="segmentado" role="radiogroup" aria-label={rotulo} onKeyDown={handleKeyDown}>
      {OPCOES.map((opcao, indice) => {
        const marcado = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            ref={(elemento) => {
              botoes.current[indice] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={marcado}
            tabIndex={marcado ? 0 : -1}
            className="segmentado-opcao"
            onClick={() => onChange(opcao.valor)}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
