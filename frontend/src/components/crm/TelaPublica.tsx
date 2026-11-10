import type { ReactNode } from 'react';

/**
 * Tela aberta sem sessão e sem a moldura (login):
 * logotipo de 96 px e slogan centralizados, com o cartão da tela abaixo
 * (spec 7.14). `topo` (opcional) fica fixo na borda de cima, fora do
 * centro: no login, o botão ou a faixa do modo demonstração.
 */
export function TelaPublica({ children, topo }: { children: ReactNode; topo?: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      {topo && <div className="absolute inset-x-0 top-0">{topo}</div>}
      <img src="/logo.svg" alt="ChokoCRM" width={96} height={96} className="size-24" />
      <p className="mt-4 text-center text-sm text-muted-foreground">Gestão de visitas para representantes comerciais</p>
      {children}
    </main>
  );
}
