/**
 * Diálogo modal do projeto (spec 2026-11-12, §3), extraído do painel "Para
 * qual cliente?" do check-in. O projeto não tem `Dialog`/`Sheet` do shadcn:
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
 * - O Tab circula dentro do painel.
 * - Em telas estreitas ocupa a largura toda, encostado embaixo, com rolagem
 *   interna; a partir de `sm` fica centrado. `largura` escolhe a largura
 *   máxima ("estreito" para listas curtas, "largo" para conferências).
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

const LARGURAS = { estreito: 'sm:max-w-lg', largo: 'sm:max-w-2xl' } as const;

type Props = {
  titulo: string;
  aberto: boolean;
  aoFechar: () => void;
  /** Enquanto `true`, Esc, "Fechar" e o fundo não fecham. */
  bloqueado?: boolean;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: keyof typeof LARGURAS;
  /** `data-testid` do fundo escurecido (os testes tocam nele). */
  idDeTesteDoFundo?: string;
};

export function Dialogo({
  titulo,
  aberto,
  aoFechar,
  bloqueado = false,
  children,
  rodape,
  largura = 'largo',
  idDeTesteDoFundo = 'fundo-do-dialogo',
}: Props) {
  const idTitulo = useId();
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
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  return createPortal(
    <div
      data-testid={idDeTesteDoFundo}
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4 print:hidden"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && !bloqueado) aoFechar();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onKeyDown={prenderTab}
        className={cn(
          'flex max-h-[85vh] w-full flex-col gap-3 rounded-t-2xl bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-lg sm:rounded-2xl sm:pb-4',
          LARGURAS[largura],
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 ref={tituloRef} id={idTitulo} tabIndex={-1} className="text-base font-semibold outline-none">
            {titulo}
          </h2>
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">{children}</div>
        {rodape && <div className="flex flex-wrap gap-2">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}
