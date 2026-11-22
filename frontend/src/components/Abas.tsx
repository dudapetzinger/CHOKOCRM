/**
 * Abas de verdade (as do Painel e da ficha do cliente):
 * `tablist` com um `tab` por aba e um `tabpanel` por conteúdo (`PainelDaAba`),
 * ligados por `aria-controls`/`aria-labelledby` a partir de `idBase`. Como só
 * o painel da aba marcada é montado, só ela leva `aria-controls` (nas outras,
 * o id apontaria para um elemento que não existe). Só a aba marcada entra no
 * Tab; as setas (e Home/End) trocam de aba e levam o
 * foco junto, com volta ao início/fim (`proximoIndicePorSeta`). Visual das
 * `AbasSituacao` (sublinhado, 44 px de altura no celular). No celular (abaixo
 * de `md`), até três abas dividem a largura numa linha só; com quatro ou mais,
 * a lista vira uma grade de duas colunas (`data-grade="true"`), cada aba
 * ocupando a sua célula com o rótulo e a pílula centrados e o sublinhado na
 * base da célula, sem rolagem horizontal. A ordem das setas é a das abas, nas
 * duas formas. Controlado: quem usa guarda a aba (em geral na URL, com
 * `useAbaNaUrl`). `AbasSituacao` é outro componente: ela filtra uma lista
 * (`aria-pressed`), não troca de painel.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { proximoIndicePorSeta } from '../lib/navegacaoSetas';

/**
 * Uma aba. `contagem` (opcional) entra no nome que o leitor de tela fala
 * ("Hoje, 5") e aparece como pílula ao lado do rótulo; sem ela a aba é só o rótulo.
 * `destaque` pinta a pílula de alerta (vermelho da situação) quando a contagem é
 * maior que zero e marca a pílula com `data-destaque="true"`; com zero, ela fica
 * como as outras.
 */
export type Aba<V extends string> = { valor: V; rotulo: string; contagem?: number; destaque?: boolean };

function idDaAba(idBase: string, valor: string): string {
  return `${idBase}-aba-${valor}`;
}

function idDoPainel(idBase: string, valor: string): string {
  return `${idBase}-painel-${valor}`;
}

/** A partir de quantas abas a lista vira grade de duas colunas no celular. */
const ABAS_PARA_A_GRADE = 4;

type Props<V extends string> = {
  idBase: string;
  ariaLabel: string;
  abas: readonly Aba<V>[];
  valor: V;
  onChange: (valor: V) => void;
};

export function Abas<V extends string>({ idBase, ariaLabel, abas, valor, onChange }: Props<V>) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const emGrade = abas.length >= ABAS_PARA_A_GRADE;

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
      className={cn(
        'flex gap-4 overflow-x-auto border-b [scrollbar-width:none] max-md:gap-0 [&::-webkit-scrollbar]:hidden',
        // Na grade, a linha de base é a borda de cada aba (uma por linha da grade), não a da lista.
        emGrade && 'max-md:grid max-md:grid-cols-2 max-md:overflow-visible max-md:border-b-0',
      )}
      role="tablist"
      aria-label={ariaLabel}
      data-grade={emGrade ? 'true' : undefined}
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
            aria-controls={marcada ? idDoPainel(idBase, aba.valor) : undefined}
            tabIndex={marcada ? 0 : -1}
            className={cn(
              '-mb-px flex shrink-0 items-center justify-center whitespace-nowrap rounded-t-md border-b-2 pb-2 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:min-h-11 max-md:flex-1 max-md:px-2',
              marcada
                ? 'border-primary-vivo text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
              emGrade && 'max-md:mb-0',
              emGrade && !marcada && 'max-md:border-border',
            )}
            aria-label={aba.contagem === undefined ? undefined : `${aba.rotulo}, ${aba.contagem}`}
            onClick={() => onChange(aba.valor)}
          >
            {aba.rotulo}
            {aba.contagem !== undefined && (
              <span
                aria-hidden="true"
                data-destaque={aba.destaque && aba.contagem > 0 ? 'true' : undefined}
                className={cn(
                  'ml-1.5 rounded-full px-1.5 text-xs',
                  aba.destaque && aba.contagem > 0
                    ? 'bg-st-red-soft font-semibold text-st-red-text'
                    : marcada
                      ? 'bg-primary-soft text-brown'
                      : 'bg-muted',
                )}
              >
                {aba.contagem}
              </span>
            )}
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
