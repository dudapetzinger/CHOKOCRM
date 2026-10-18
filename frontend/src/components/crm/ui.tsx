/**
 * Peças de interface do protótipo (`crm/ui.tsx` do Lovable) adaptadas ao app:
 * nomes em português, `Cor` em maiúsculas e os ajustes de contraste da spec
 * (6.3) — texto verde, vermelho e azul nos tons `*-text`, texto sobre o
 * laranja suave em `text-brown`.
 */
import { cloneElement, useId, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { iniciais } from '@/lib/iniciais';
import type { Cor } from '@/services/clients';

/** Classes de cada cor de classificação: ponto (marca sem texto), fundo suave e texto sobre ele. */
export const CLASSES_COR: Record<Cor, { ponto: string; fundo: string; texto: string }> = {
  VERDE: { ponto: 'bg-st-green', fundo: 'bg-st-green-soft', texto: 'text-st-green-text' },
  AMARELO: { ponto: 'bg-st-yellow', fundo: 'bg-st-yellow-soft', texto: 'text-brown' },
  LARANJA: { ponto: 'bg-st-orange', fundo: 'bg-st-orange-soft', texto: 'text-brown' },
  VERMELHO: { ponto: 'bg-st-red', fundo: 'bg-st-red-soft', texto: 'text-st-red-text' },
};

const CLASSES_TOM = {
  neutro: 'bg-muted text-muted-foreground',
  verde: 'bg-st-green-soft text-st-green-text',
  laranja: 'bg-primary-soft text-brown',
  vermelho: 'bg-st-red-soft text-st-red-text',
  azul: 'bg-chart-soft text-chart-text',
} as const;

/** Etiqueta em pílula (`Tag` do protótipo); `azul` é a das campanhas. */
export function Etiqueta({ tom = 'neutro', children }: { tom?: keyof typeof CLASSES_TOM; children: ReactNode }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', CLASSES_TOM[tom])}>
      {children}
    </span>
  );
}

const CLASSES_AVISO = {
  info: 'border-border bg-muted text-muted-foreground',
  atencao: 'border-st-yellow/60 bg-st-yellow-soft text-brown',
  erro: 'border-st-red/40 bg-st-red-soft text-st-red-text',
} as const;

/**
 * Aviso em caixa dentro das telas: `erro` (falha de
 * carregamento ou de envio, texto vermelho escuro sobre o fundo suave,
 * 5,6:1), `atencao` (texto marrom sobre o amarelo suave) e `info`. Com o
 * fundo próprio, o contraste vale tanto sobre o cartão quanto sobre o fundo
 * da página. Quem usa decide o `role` (`alert` para erro que aparece depois).
 */
export function Aviso({
  tom = 'info',
  className,
  ...props
}: ComponentProps<'p'> & { tom?: keyof typeof CLASSES_AVISO }) {
  return <p className={cn('rounded-lg border px-4 py-3 text-sm', CLASSES_AVISO[tom], className)} {...props} />;
}

/**
 * `<select>` nativo com o visual do protótipo (`selectCls` de `crm/shell.tsx`):
 * 36 px no desktop; 44 px e 16 px no celular (spec 6.2 e 6.4).
 */
export const CLASSES_SELECT =
  'h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-md:h-11 max-md:text-base';

/**
 * Botão de ação perigosa em texto vermelho ("Inativar cliente", "Remover"),
 * para somar às variantes `outline` e `ghost` do `Button`. O fundo fica
 * sempre claro o bastante para o texto vermelho: branco em repouso
 * (`--destructive` dá 4,7:1; sobre o `bg-background` do outline daria 4,4:1)
 * e vermelho suave com o texto escuro no hover (5,6:1; o `bg-accent` do
 * shadcn daria 4,15:1).
 */
export const CLASSES_BOTAO_PERIGO = 'bg-card text-destructive hover:bg-st-red-soft hover:text-st-red-text';

/** Círculo com as iniciais. Decorativo: o nome sempre aparece ao lado (ou no rótulo do botão). */
export function Avatar({ nome, tamanho = 40 }: { nome: string; tamanho?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-brown"
    >
      {iniciais(nome)}
    </span>
  );
}

/** Cartão branco do protótipo (`Card`). Com título, vira uma região com o nome dele. */
export function Cartao({
  titulo,
  acao,
  className,
  children,
}: {
  titulo?: ReactNode;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const idTitulo = useId();
  return (
    <section className={cn('rounded-xl border bg-card p-5', className)} aria-labelledby={titulo ? idTitulo : undefined}>
      {(titulo || acao) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {titulo && (
            <h2 id={idTitulo} className="text-base font-semibold">
              {titulo}
            </h2>
          )}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

type PropsDoControle = { 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' };

/**
 * Rótulo acima do controle, ajuda e erro abaixo (`Field` do protótipo). O
 * controle (um elemento só, com `id` igual a `htmlFor`) recebe
 * `aria-describedby` com a ajuda e o erro e, havendo erro, `aria-invalid`.
 */
export function Campo({
  rotulo,
  htmlFor,
  ajuda,
  erro,
  children,
}: {
  rotulo: ReactNode;
  htmlFor: string;
  ajuda?: ReactNode;
  erro?: ReactNode;
  children: ReactElement<PropsDoControle>;
}) {
  const idAjuda = `${htmlFor}-ajuda`;
  const idErro = `${htmlFor}-erro`;
  const descricao = [children.props['aria-describedby'], ajuda ? idAjuda : null, erro ? idErro : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {rotulo}
      </label>
      {cloneElement(children, {
        'aria-describedby': descricao || undefined,
        'aria-invalid': erro ? true : children.props['aria-invalid'],
      })}
      {ajuda && (
        <p id={idAjuda} className="text-xs text-muted-foreground">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={idErro} className="text-sm font-medium text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
