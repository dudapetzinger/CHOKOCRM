import type { ReactNode } from 'react';

/**
 * Telas abertas sem sessão e sem a moldura (login e redefinição de senha):
 * logotipo de 96 px e slogan centralizados, com o cartão de cada tela abaixo
 * (spec 7.14).
 */
export function TelaPublica({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <img src="/logo.svg" alt="ChokoCRM" width={96} height={96} className="size-24" />
      <p className="mt-4 text-center text-sm text-muted-foreground">Gestão de visitas para representantes comerciais</p>
      {children}
    </main>
  );
}
