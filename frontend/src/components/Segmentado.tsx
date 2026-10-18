/**
 * Controle segmentado genérico (Etapa 8): opções lado a lado no padrão
 * `radiogroup`, como `SegmentadoResultado` — só a opção marcada entra no Tab
 * e as setas trocam a seleção. Base dos filtros de período e de horizonte
 * (via `FiltroPilulas`). Cada opção pode ter um rótulo curto na tela e um
 * nome acessível mais longo (ex.: "30" e "30 dias"). Visual do `Segmented`
 * do protótipo: trilho cinza com a opção marcada em branco. `compacto` deixa
 * as opções mais estreitas no desktop; no celular todas têm 44 px de altura.
 */
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { proximoIndicePorSeta } from '../lib/navegacaoSetas';

/**
 * Trilho e opções do controle segmentado, compartilhados com
 * `SeletorRecorrencia`. No celular toda opção tem 44 px (spec 6.4).
 */
export const CLASSES_TRILHO = 'inline-flex max-w-full flex-wrap rounded-lg border bg-muted p-0.5';
export const CLASSES_OPCAO =
  'rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11 max-md:min-w-11';
export const CLASSES_OPCAO_MARCADA = 'bg-card text-foreground shadow-sm';
export const CLASSES_OPCAO_DESMARCADA = 'text-muted-foreground hover:text-foreground';

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
    <div className={CLASSES_TRILHO} role="radiogroup" aria-label={ariaLabel} onKeyDown={handleKeyDown}>
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
            className={cn(
              CLASSES_OPCAO,
              compacto && 'px-2.5',
              marcado ? CLASSES_OPCAO_MARCADA : CLASSES_OPCAO_DESMARCADA,
            )}
            onClick={() => onChange(opcao.valor)}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
