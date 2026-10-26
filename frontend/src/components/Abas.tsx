/**
 * Abas de verdade (Etapa 9, spec das abas do Painel e da ficha do cliente):
 * `tablist` com um `tab` por aba e um `tabpanel` por conteúdo (`PainelDaAba`),
 * ligados por `aria-controls`/`aria-labelledby` a partir de `idBase`. Só a
 * aba marcada entra no Tab; as setas (e Home/End) trocam de aba e levam o
 * foco junto, com volta ao início/fim (`proximoIndicePorSeta`). Visual das
 * `AbasSituacao` (sublinhado, 44 px de altura no celular); no celular as abas
 * dividem a largura. Controlado: quem usa guarda a aba (em geral na URL, com
 * `useAbaNaUrl`). `AbasSituacao` continua separada: ela filtra uma lista
 * (`aria-pressed`), não troca de painel.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { proximoIndicePorSeta } from '../lib/navegacaoSetas';

export type Aba<V extends string> = { valor: V; rotulo: string };

function idDaAba(idBase: string, valor: string): string {
  return `${idBase}-aba-${valor}`;
}

function idDoPainel(idBase: string, valor: string): string {
  return `${idBase}-painel-${valor}`;
}

type Props<V extends string> = {
  idBase: string;
  ariaLabel: string;
  abas: readonly Aba<V>[];
  valor: V;
  onChange: (valor: V) => void;
};

export function Abas<V extends string>({ idBase, ariaLabel, abas, valor, onChange }: Props<V>) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const atual = abas.findIndex((aba) => aba.valor === valor);
    const proximo = proximoIndicePorSeta(event.key, atual, abas.length);
    if (proximo === null) return;
    event.preventDefault();
    onChange(abas[proximo].valor);
    botoes.current[proximo]?.focus();
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto border-b [scrollbar-width:none] max-md:gap-0 [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {abas.map((aba, indice) => {
        const marcada = aba.valor === valor;
        return (
          <button
            key={aba.valor}
            ref={(elemento) => {
              botoes.current[indice] = elemento;
            }}
            type="button"
            role="tab"
            id={idDaAba(idBase, aba.valor)}
            aria-selected={marcada}
            aria-controls={idDoPainel(idBase, aba.valor)}
            tabIndex={marcada ? 0 : -1}
            className={cn(
              '-mb-px flex shrink-0 items-center justify-center whitespace-nowrap rounded-t-md border-b-2 pb-2 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:min-h-11 max-md:flex-1 max-md:px-2',
              marcada
                ? 'border-primary-vivo text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onChange(aba.valor)}
          >
            {aba.rotulo}
          </button>
        );
      })}
    </div>
  );
}

type PropsDoPainel<V extends string> = {
  idBase: string;
  valor: V;
  children: ReactNode;
  className?: string;
};

/** Conteúdo de uma aba; quem usa desenha só o painel da aba marcada. */
export function PainelDaAba<V extends string>({ idBase, valor, children, className }: PropsDoPainel<V>) {
  return (
    <div role="tabpanel" id={idDoPainel(idBase, valor)} aria-labelledby={idDaAba(idBase, valor)} className={className}>
      {children}
    </div>
  );
}
