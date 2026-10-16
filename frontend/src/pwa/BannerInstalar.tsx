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
    await evento.prompt();
    const escolha = await evento.userChoice;
    if (escolha?.outcome === 'dismissed') dispensar();
  }

  return (
    <section className="banner-instalar" aria-labelledby="titulo-banner-instalar">
      <img className="banner-instalar-icone" src="/pwa-192.png" alt="" width={44} height={44} />
      <div className="banner-instalar-texto">
        <p id="titulo-banner-instalar" className="banner-instalar-titulo">
          Use o ChokoCRM como app
        </p>
        <p className="banner-instalar-descricao">
          {ios
            ? 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'
            : 'Ícone na tela inicial e tela cheia, sem a barra do navegador.'}
        </p>
      </div>
      <div className="banner-instalar-acoes">
        {evento && (
          <button type="button" className="btn-primario" onClick={() => void instalar()}>
            Instalar o ChokoCRM
          </button>
        )}
        <button type="button" className="btn-secundario" onClick={dispensar}>
          Agora não
        </button>
      </div>
    </section>
  );
}

export default BannerInstalar;
