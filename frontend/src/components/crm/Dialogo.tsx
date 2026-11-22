/**
 * Diálogo modal do projeto. O projeto não tem `Dialog`/`Sheet` do shadcn:
 * é um `role="dialog"` com `aria-modal`, num fundo escurecido fixo, desenhado
 * em `document.body` (fora da navegação e de quem o usa).
 *
 * - Título (`h2`, `tabIndex={-1}`) dá o nome ao diálogo (`aria-labelledby`).
 *   Ao abrir, o foco vai para ele, a não ser que o conteúdo já tenha posto o
 *   foco dentro do painel (a busca do check-in, o título da conferência).
 * - Esc (no documento: um toque num trecho sem controle tira o foco do
 *   painel), "Fechar" (o "X") e um toque no fundo chamam `aoFechar()`.
 *   Com `bloqueado` (ex.: lendo ou gravando notas), nenhum dos três fecha e o
 *   "X" fica desabilitado: quem usa decide quando o trabalho acabou.
 * - O Tab circula dentro do painel. Com o foco fora dos controles (no título,
 *   ao abrir), o Tab vai ao primeiro controle e o Shift+Tab, ao último.
 * - Enquanto há diálogo aberto, a página atrás não rola (`overflow: hidden`
 *   no `html`, devolvido quando o último fecha), e a rolagem do corpo não
 *   passa para ela (`overscroll-contain`). Onde a barra de rolagem da página
 *   ocupa largura (desktop), o `html` ganha um `padding-right` do tamanho
 *   dela enquanto a trava dura, e a página não se desloca.
 * - `descricao`, opcional, fica logo abaixo do título e descreve o diálogo
 *   (`aria-describedby`).
 * - Forma (`variante`): "centro" (padrão) ocupa a largura toda em telas
 *   estreitas, encostado embaixo, com rolagem interna, e a partir de `sm`
 *   fica centrado; `largura` escolhe a largura máxima ("estreito" para listas
 *   curtas, "largo" para conferências). "lateral" é o painel lateral
 *   (`PainelLateral`): tela cheia no celular (com as margens seguras do
 *   aparelho nos quatro lados) e, a partir de `sm`, encostado à
 *   direita, na altura toda, com até 28 rem; entra deslizando da direita,
 *   menos com `prefers-reduced-motion`.
 * - `rodape` fica fora da rolagem, sempre à vista.
 * Para onde o foco volta ao fechar é decisão de quem abriu.
 */
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FOCAVEIS =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Quantos diálogos estão abertos e o `overflow` e o `padding-right` do `html`
 * de antes do primeiro: abrir um segundo não guarda os valores da trava do
 * primeiro como os valores a devolver.
 */
const travaDaRolagem = { abertos: 0, overflowAnterior: '', paddingAnterior: '' };

function travarRolagem(): () => void {
  const raiz = document.documentElement;
  if (travaDaRolagem.abertos === 0) {
    travaDaRolagem.overflowAnterior = raiz.style.overflow;
    travaDaRolagem.paddingAnterior = raiz.style.paddingRight;
    // Medida antes de esconder a rolagem: a largura que a barra da página ocupa (zero no celular).
    const larguraDaBarra = window.innerWidth - raiz.clientWidth;
    if (larguraDaBarra > 0) raiz.style.paddingRight = `${larguraDaBarra}px`;
  }
  travaDaRolagem.abertos += 1;
  raiz.style.overflow = 'hidden';
  return () => {
    travaDaRolagem.abertos -= 1;
    if (travaDaRolagem.abertos === 0) {
      raiz.style.overflow = travaDaRolagem.overflowAnterior;
      raiz.style.paddingRight = travaDaRolagem.paddingAnterior;
    }
  };
}

const LARGURAS = { estreito: 'sm:max-w-lg', largo: 'sm:max-w-2xl' } as const;

/** O fundo escurecido e o painel de cada forma. */
const FORMAS = {
  centro: {
    fundo: 'items-end justify-center sm:items-center sm:p-4',
    painel:
      'max-h-[85vh] w-full rounded-t-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-4',
  },
  lateral: {
    fundo: 'justify-end',
    painel:
      'h-dvh w-full pt-[calc(0.75rem+env(safe-area-inset-top))] pr-[calc(1rem+env(safe-area-inset-right))] pl-[calc(1rem+env(safe-area-inset-left))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-md motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200',
  },
} as const;

type Props = {
  titulo: string;
  /** Uma linha logo abaixo do título, que descreve o diálogo. */
  descricao?: ReactNode;
  aberto: boolean;
  aoFechar: () => void;
  /** Enquanto `true`, Esc, "Fechar" e o fundo não fecham. */
  bloqueado?: boolean;
  children: ReactNode;
  rodape?: ReactNode;
  /** Só na variante "centro". */
  largura?: keyof typeof LARGURAS;
  variante?: keyof typeof FORMAS;
  /** `data-testid` do fundo escurecido (os testes tocam nele). */
  idDeTesteDoFundo?: string;
};

export function Dialogo({
  titulo,
  descricao,
  aberto,
  aoFechar,
  bloqueado = false,
  children,
  rodape,
  largura = 'largo',
  variante = 'centro',
  idDeTesteDoFundo = 'fundo-do-dialogo',
}: Props) {
  const idTitulo = useId();
  const idDescricao = useId();
  const forma = FORMAS[variante];
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // O Esc no documento lê sempre o último `aoFechar` e `bloqueado`, sem reinscrever a cada render.
  const fechar = useRef(aoFechar);
  const travado = useRef(bloqueado);
  useEffect(() => {
    fechar.current = aoFechar;
    travado.current = bloqueado;
  });

  useEffect(() => {
    if (!aberto) return;
    if (!painelRef.current?.contains(document.activeElement)) tituloRef.current?.focus();
  }, [aberto]);

  useEffect(() => (aberto ? travarRolagem() : undefined), [aberto]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclarEsc(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape' && !travado.current) fechar.current();
    }
    document.addEventListener('keydown', aoTeclarEsc);
    return () => document.removeEventListener('keydown', aoTeclarEsc);
  }, [aberto]);

  if (!aberto) return null;

  /** Tab circula dentro do painel (modal). */
  function prenderTab(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Tab' || !painelRef.current) return;
    const focaveis = [...painelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!primeiro || !ultimo) {
      // Nenhum controle habilitado (ex.: tudo desabilitado durante "Importando…"): o foco fica no título.
      evento.preventDefault();
      tituloRef.current?.focus();
      return;
    }
    // Fora dos controles (o título, ao abrir): o Shift+Tab sairia do painel para a página atrás.
    const foraDosControles = !focaveis.some((elemento) => elemento === document.activeElement);
    if (evento.shiftKey && (foraDosControles || document.activeElement === primeiro)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && (foraDosControles || document.activeElement === ultimo)) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  return createPortal(
    <div
      data-testid={idDeTesteDoFundo}
      className={cn('fixed inset-0 z-40 flex bg-foreground/40 print:hidden', forma.fundo)}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && !bloqueado) aoFechar();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        onKeyDown={prenderTab}
        className={cn(
          'flex flex-col gap-3 bg-card text-foreground shadow-lg',
          forma.painel,
          variante === 'centro' && LARGURAS[largura],
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 ref={tituloRef} id={idTitulo} tabIndex={-1} className="text-base font-semibold outline-none">
              {titulo}
            </h2>
            {descricao && (
              <p id={idDescricao} className="text-sm text-muted-foreground">
                {descricao}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            className="-mr-2 text-muted-foreground"
            disabled={bloqueado}
            onClick={aoFechar}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        {/* A área de rolagem avança sobre as margens do painel: à direita, a barra não cobre o fim
            das linhas; à esquerda, o anel de foco da primeira coluna aparece inteiro. */}
        <div className="-mx-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3">{children}</div>
        {rodape && <div className="flex flex-wrap gap-2">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}
