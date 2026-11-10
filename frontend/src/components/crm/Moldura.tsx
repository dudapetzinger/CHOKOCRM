/**
 * Moldura das telas autenticadas (spec 6.5), a partir do `crm/shell.tsx` do
 * protótipo, sem o seletor "Ver como" e sem o login embutido (o app tem
 * `LoginPage` e `RequireAuth`). A partir de 768 px: menu lateral de 240 px
 * com a marca. Abaixo: navegação inferior fixa. Nos dois: barra superior de
 * 56 px com o título da tela e o menu da conta. Só uma das duas navegações
 * existe de cada vez (pela mesma largura de `useLarguraDesktop`), para o
 * leitor de tela não achar dois menus iguais.
 *
 * Barra inferior (specs 2026-11-06 §3 B e 2026-11-09 §3): os dois papéis têm
 * 5 posições, com um botão central (`BotaoCentral`, círculo primário elevado).
 * Representante: Clientes, Agenda, `BotaoCheckIn` (abre "Para qual cliente?"),
 * Painel, Campanhas. Gestor: Painel, Clientes, "Importar notas" (navega para
 * `/importacoes`), Agenda, Campanhas; "Usuários" fica no menu da conta. O menu
 * lateral do desktop mostra a lista de atalhos do papel sem o botão central
 * (no desktop o check-in começa pela ficha do cliente; "Importar notas" é o
 * quinto item do gestor).
 *
 * Relógio de demonstração: a moldura carrega `GET /sistema/relogio`
 * (`useRelogio`) e só mostra a tela da rota depois da primeira resposta (ou
 * da falha, com o relógio real), para nenhuma tela calcular "hoje" sem o
 * deslocamento; as buscas seguintes (foco, a cada 5 min) não desmontam a
 * tela. A `FaixaDataSimulada` fica acima do conteúdo; depois de uma busca que
 * falhou (`isError`, mesmo com a resposta antiga no cache) não há faixa,
 * porque `useRelogio` já voltou o deslocamento a 0.
 */
import { matchPath, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, CalendarDays, FileUp, Megaphone, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useRelogio } from '@/hooks/useRelogio';
import type { Role } from '@/auth/auth-context';
import { Button } from '@/components/ui/button';
import { useLarguraDesktop } from '@/lib/useLarguraDesktop';
import { cn } from '@/lib/utils';
import { BotaoCentral } from './BotaoCentral';
import { BotaoCheckIn } from './BotaoCheckIn';
import { FaixaDataSimulada } from './FaixaDataSimulada';
import { MenuDaConta } from './MenuDaConta';

type ItemNavegacao = { para: string; rotulo: string; icone: LucideIcon; papeis: Role[] };

/**
 * Atalhos da navegação e quem vê cada um, na ordem do representante
 * (Clientes, Agenda, Painel, Campanhas; o botão central entra depois de
 * `ATALHOS_ANTES_DO_BOTAO_CENTRAL`). O gestor vê o Painel, a tela inicial
 * dele, na frente e Importar notas no fim (no celular esse item vira o botão
 * central): Painel, Clientes, Agenda, Campanhas, Importar notas. As ordens
 * estão fixadas em Moldura.test.tsx.
 */
export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { para: '/clientes', rotulo: 'Clientes', icone: Users, papeis: ['GESTOR', 'REPRESENTANTE'] },
  { para: '/agenda', rotulo: 'Agenda', icone: CalendarDays, papeis: ['GESTOR', 'REPRESENTANTE'] },
  { para: '/painel', rotulo: 'Painel', icone: BarChart3, papeis: ['GESTOR', 'REPRESENTANTE'] },
  { para: '/campanhas', rotulo: 'Campanhas', icone: Megaphone, papeis: ['GESTOR', 'REPRESENTANTE'] },
  { para: '/importacoes', rotulo: 'Importar notas', icone: FileUp, papeis: ['GESTOR'] },
];

/** Nas barras do celular, o botão central fica depois destes dois atalhos. */
const ATALHOS_ANTES_DO_BOTAO_CENTRAL = 2;

function itensDoPapel(role: Role): ItemNavegacao[] {
  const itens = ITENS_NAVEGACAO.filter((item) => item.papeis.includes(role));
  if (role !== 'GESTOR') return itens;
  return [...itens.filter((item) => item.para === '/painel'), ...itens.filter((item) => item.para !== '/painel')];
}

/** Atalho da barra inferior (celular): ícone em cima, rótulo embaixo, ocupando uma posição. */
function AtalhoDaBarra({ item }: { item: ItemNavegacao }) {
  return (
    <NavLink
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
  );
}

/**
 * Título da barra superior por rota, do caminho mais específico para o mais
 * geral. `interna`: tela aberta a partir de outra (ficha, novo cliente,
 * check-in, novo usuário, alterar senha), que no celular ganha "Voltar".
 */
const TITULOS_DAS_ROTAS: { padrao: string; titulo: string; interna: boolean }[] = [
  { padrao: '/painel', titulo: 'Painel de indicadores', interna: false },
  { padrao: '/agenda', titulo: 'Agenda', interna: false },
  { padrao: '/campanhas', titulo: 'Campanhas e eventos', interna: false },
  { padrao: '/clientes/novo', titulo: 'Novo cliente', interna: true },
  { padrao: '/clientes/:id/check-in', titulo: 'Novo check-in', interna: true },
  { padrao: '/clientes/:id', titulo: 'Clientes', interna: true },
  { padrao: '/clientes', titulo: 'Clientes', interna: false },
  { padrao: '/usuarios/novo', titulo: 'Novo usuário', interna: true },
  { padrao: '/usuarios', titulo: 'Usuários', interna: false },
  { padrao: '/importacoes', titulo: 'Importar notas', interna: false },
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
  const relogio = useRelogio();

  if (!user) return null;

  const itens = itensDoPapel(user.role);
  // No celular, "Importar notas" do gestor é o botão central, não um atalho.
  const atalhosDaBarra = itens.filter((item) => item.para !== '/importacoes');
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

        {relogio.data && !relogio.isError && (
          <FaixaDataSimulada simulado={relogio.data.simulado} dataDeDemonstracao={relogio.data.dataDeDemonstracao} />
        )}

        {/* No celular, espaço embaixo para o conteúdo não ficar atrás da
            navegação inferior (56 px + a área segura do aparelho); no
            representante e no gestor, também atrás do botão central,
            elevado 24 px acima da barra */}
        <main
          className={cn(
            'flex-1 p-4 md:p-6',
            !desktop && 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]',
          )}
        >
          {relogio.isPending ? <p className="text-sm text-muted-foreground">Carregando...</p> : <Outlet />}
        </main>
      </div>

      {!desktop && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-card pb-[env(safe-area-inset-bottom)] print:hidden"
        >
          {atalhosDaBarra.slice(0, ATALHOS_ANTES_DO_BOTAO_CENTRAL).map((item) => (
            <AtalhoDaBarra key={item.para} item={item} />
          ))}
          <div className="flex flex-1 justify-center">
            {user.role === 'REPRESENTANTE' ? (
              <BotaoCheckIn representanteId={user.id} />
            ) : (
              <BotaoCentral
                rotulo="Importar notas"
                ariaLabel="Importar notas"
                icone={FileUp}
                onClick={() => navigate('/importacoes')}
              />
            )}
          </div>
          {atalhosDaBarra.slice(ATALHOS_ANTES_DO_BOTAO_CENTRAL).map((item) => (
            <AtalhoDaBarra key={item.para} item={item} />
          ))}
        </nav>
      )}
    </div>
  );
}
