/**
 * Convite para instalar o ChokoCRM na tela inicial (ADR-012).
 *
 * - Chrome/Edge (Android e desktop) disparam `beforeinstallprompt` quando o
 *   app é instalável: guardamos o evento (o `preventDefault` tira o
 *   mini-infobar do navegador) e o botão "Instalar o ChokoCRM" abre o
 *   diálogo nativo com `prompt()`. O ouvinte fica ligado desde a abertura
 *   do app, mesmo antes do login, para não perder o evento.
 * - O Safari do iPhone/iPad não tem esse evento: mostramos o caminho manual.
 * - Nunca aparece com o app já instalado (`display-mode: standalone`), nem
 *   sem usuário logado, nem por 30 dias depois de "Agora não".
 */
import { useContext, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AuthContext } from '../auth/auth-context';

export const CHAVE_INSTALAR_DISPENSADO = 'chokocrm:instalar-dispensado';

const DIAS_DISPENSADO = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

/** O evento não está nos tipos do DOM (só Chromium o implementa). */
type EventoPodeInstalar = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function abertoComoApp(): boolean {
  const standaloneIos = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standalone =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return standalone || standaloneIos;
}

function ehIos(): boolean {
  return /iphone|ipad/i.test(navigator.userAgent);
}

/** "Agora não" há menos de 30 dias? Sem `localStorage` (modo privado, bloqueio), não. */
function dispensadoHaPouco(): boolean {
  try {
    const gravado = localStorage.getItem(CHAVE_INSTALAR_DISPENSADO);
    if (!gravado) return false;
    const quando = new Date(gravado).getTime();
    return !Number.isNaN(quando) && Date.now() - quando < DIAS_DISPENSADO * DIA_MS;
  } catch {
    return false;
  }
}

function gravarDispensa(): void {
  try {
    localStorage.setItem(CHAVE_INSTALAR_DISPENSADO, new Date().toISOString());
  } catch {
    // Sem armazenamento: esconde só nesta sessão.
  }
}

export function BannerInstalar() {
  const usuario = useContext(AuthContext)?.user ?? null;
  const [evento, setEvento] = useState<EventoPodeInstalar | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [dispensado, setDispensado] = useState(dispensadoHaPouco);

  useEffect(() => {
    function aoPoderInstalar(e: Event) {
      e.preventDefault();
      setEvento(e as EventoPodeInstalar);
    }
    function aoInstalar() {
      setInstalado(true);
      setEvento(null);
    }
    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  if (!usuario || instalado || dispensado || abertoComoApp()) return null;

  const ios = ehIos();
  if (!evento && !ios) return null;

  function dispensar() {
    gravarDispensa();
    setDispensado(true);
  }

  async function instalar() {
    if (!evento) return;
    // O `prompt()` só vale uma vez por evento: depois dele, o banner sai.
    setEvento(null);
    try {
      await evento.prompt();
      const escolha = await evento.userChoice;
      if (escolha?.outcome === 'dismissed') dispensar();
    } catch {
      // O navegador recusou o diálogo (evento já usado, página sem foco): o banner já saiu; não há o que fazer.
    }
  }

  // Cartão com sombra (o que flutua sobre a tela), até 560 px, centralizado;
  // 8 px de respiro dos lados no celular. Rola com a página.
  return (
    <section
      className="mx-2 my-2 grid max-w-[560px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-card p-4 shadow-lg min-[576px]:mx-auto print:hidden"
      aria-labelledby="titulo-banner-instalar"
    >
      <img className="size-11 rounded-md" src="/pwa-192.png" alt="" width={44} height={44} />
      <div className="min-w-0">
        <p id="titulo-banner-instalar" className="font-semibold text-foreground">
          Use o ChokoCRM como app
        </p>
        <p className="text-sm text-muted-foreground">
          {ios
            ? 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'
            : 'Ícone na tela inicial e tela cheia, sem a barra do navegador.'}
        </p>
      </div>
      {/* Os dois botões dividem a linha (em telas estreitas, um embaixo do
          outro); só "Agora não" (iPhone) fica à direita, na largura do texto */}
      <div className="col-span-full flex flex-wrap justify-end gap-2">
        {evento && (
          <Button type="button" className="flex-1" onClick={() => void instalar()}>
            <Download aria-hidden="true" />
            Instalar o ChokoCRM
          </Button>
        )}
        <Button type="button" variant="outline" className={cn(evento && 'flex-1')} onClick={dispensar}>
          Agora não
        </Button>
      </div>
    </section>
  );
}

export default BannerInstalar;
