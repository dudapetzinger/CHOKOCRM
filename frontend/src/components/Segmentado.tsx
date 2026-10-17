/**
 * Controle segmentado genérico (Etapa 8): opções lado a lado no padrão
 * `radiogroup`, como `SegmentadoResultado` — só a opção marcada entra no Tab
 * e as setas trocam a seleção. Base dos filtros de período e de horizonte
 * (via `FiltroPilulas`). Cada opção pode ter um rótulo curto na tela e um
 * nome acessível mais longo (ex.: "30" e "30 dias"). `compacto` deixa as
 * opções com 36 px no desktop (no celular continuam com 44 px).
 */
import { useRef, type KeyboardEvent } from 'react';
import { proximoIndicePorSeta } from '../lib/navegacaoSetas';

export type Opcao<V> = { valor: V; rotulo: string; rotuloAcessivel?: string };

type Props<V extends string | number> = {
  ariaLabel: string;
  opcoes: readonly Opcao<V>[];
  valor: V;
  onChange: (valor: V) => void;
  compacto?: boolean;
};

export function Segmentado<V extends string | number>({ ariaLabel, opcoes, valor, onChange, compacto }: Props<V>) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const atual = opcoes.findIndex((opcao) => opcao.valor === valor);
    const proximo = proximoIndicePorSeta(event.key, atual, opcoes.length);
    if (proximo === null) return;
    event.preventDefault();
    onChange(opcoes[proximo].valor);
    botoes.current[proximo]?.focus();
  }

  return (
    <div
      className={compacto ? 'segmentado segmentado-compacto' : 'segmentado'}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {opcoes.map((opcao, indice) => {
        const marcado = opcao.valor === valor;
        return (
          <button
            key={String(opcao.valor)}
            ref={(elemento) => {
              botoes.current[indice] = elemento;
            }}
            type="button"
            role="radio"
            aria-checked={marcado}
            aria-label={opcao.rotuloAcessivel}
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
