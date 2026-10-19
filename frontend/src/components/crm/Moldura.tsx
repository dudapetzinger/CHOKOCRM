/**
 * Moldura das telas autenticadas (spec 6.5), a partir do `crm/shell.tsx` do
 * protótipo, sem o seletor "Ver como" e sem o login embutido (o app tem
 * `LoginPage` e `RequireAuth`). A partir de 768 px: menu lateral de 240 px
 * com a marca. Abaixo: navegação inferior fixa. Nos dois: barra superior de
 * 56 px com o título da tela e o menu da conta. Só uma das duas navegações
 * existe de cada vez (pela mesma largura de `useLarguraDesktop`), para o
 * leitor de tela não achar dois menus iguais.
 */
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarDays, UserCog, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import type { Role } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { rotaInicialDoPapel } from '@/lib/rotaInicial';
import { useLarguraDesktop } from '@/lib/useLarguraDesktop';
import { cn } from '@/lib/utils';
import { MenuDaConta } from './MenuDaConta';

type ItemNavegacao = { para: string; rotulo: string; icone: LucideIcon; papeis: Role[] };

/**
 * Atalhos da navegação e quem vê cada um. Cada papel vê os seus nesta
 * ordem, com a tela inicial dele (`rotaInicialDoPapel`) puxada para a
 * frente: gestor — Painel, Clientes, Agenda, Usuários; representante —
 * Agenda, Clientes. Item novo entra na posição em que deve aparecer depois da
 * tela inicial (as ordens estão fixadas em Moldura.test.tsx).
 */
export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { para: '/clientes', rotulo: 'Clientes', icone: Users, papeis: ['GESTOR', 'REPRESENTANTE'] },
  { para: '/painel', rotulo: 'Painel', icone: BarChart3, papeis: ['GESTOR'] },
  { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays, papeis: ['GESTOR', 'REPRESENTANTE'] },
  { para: '/usuarios', rotulo: 'Usuários', icone: UserCog, papeis: ['GESTOR'] },
];

function itensDoPapel(role: Role): ItemNavegacao[] {
  const itens = ITENS_NAVEGACAO.filter((item) => item.papeis.includes(role));
  const inicial = rotaInicialDoPapel(role);
  return [...itens.filter((item) => item.para === inicial), ...itens.filter((item) => item.para !== inicial)];
}

/**
 * Título da barra superior por rota, do caminho mais específico para o mais
 * geral. `interna`: tela aberta a partir de outra (ficha, novo cliente,
 * check-in, novo usuário, alterar senha), que no celular ganha "Voltar".
 */
const TITULOS_DAS_ROTAS: { padrao: string; titulo: string; interna: boolean }[] = [
  { padrao: '/painel', titulo: 'Painel de indicadores', interna: false },
  { padrao: '/agenda', titulo: 'Agenda', interna: false },
  { padrao: '/clientes/novo', titulo: 'Novo cliente', interna: true },
  { padrao: '/clientes/:id/check-in', titulo: 'Novo check-in', interna: true },
  { padrao: '/clientes/:id', titulo: 'Clientes', interna: true },
  { padrao: '/clientes', titulo: 'Clientes', interna: false },
  { padrao: '/usuarios/novo', titulo: 'Novo usuário', interna: true },
  { padrao: '/usuarios', titulo: 'Usuários', interna: false },
  { padrao: '/conta/senha', titulo: 'Alterar senha', interna: true },
];

export function tituloDaRota(pathname: string): { titulo: string; interna: boolean } {
  const rota = TITULOS_DAS_ROTAS.find(({ padrao }) => matchPath(padrao, pathname));
  return rota ? { titulo: rota.titulo, interna: rota.interna } : { titulo: 'ChokoCRM', interna: false };
}

export function Moldura() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const desktop = useLarguraDesktop();

  if (!user) return null;

  const itens = itensDoPapel(user.role);
  const { titulo, interna } = tituloDaRota(pathname);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {desktop && (
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-card p-4 print:hidden">
          <div className="mb-6 flex items-center gap-3 px-2">
            <img src="/logo.svg" alt="ChokoCRM" width={40} height={40} className="size-10" />
            <span aria-hidden="true" className="font-bold text-brown">
              ChokoCRM
            </span>
          </div>
          <nav aria-label="Navegação principal" className="space-y-1">
            {itens.map((item) => (
              <NavLink
                key={item.para}
                to={item.para}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'bg-primary-soft text-brown' : 'text-muted-foreground hover:bg-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icone aria-hidden="true" className={cn('size-4', isActive && 'text-primary-vivo')} />
                    {item.rotulo}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <p className="mt-auto px-2 text-xs text-muted-foreground">Chokolaten</p>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-card px-4 md:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-1">
            {interna && !desktop && (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 shrink-0 text-muted-foreground"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft aria-hidden="true" />
                Voltar
              </Button>
            )}
            <h1 className="truncate text-lg font-semibold">{titulo}</h1>
          </div>
          <MenuDaConta />
        </header>

        {/* No celular, espaço embaixo para o conteúdo não ficar atrás da
            navegação inferior (56 px + a área segura do aparelho) */}
        <main className={cn('flex-1 p-4 md:p-6', !desktop && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]')}>
          <Outlet />
        </main>
      </div>

      {!desktop && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card pb-[env(safe-area-inset-bottom)] print:hidden"
        >
          {itens.map((item) => (
            <NavLink
              key={item.para}
              to={item.para}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  isActive ? 'bg-primary-soft text-brown' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icone aria-hidden="true" className={cn('size-5', isActive && 'text-primary-vivo')} />
                  {item.rotulo}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
