import { WifiOff } from 'lucide-react';
import { useOnline } from './useOnline';

/**
 * Faixa no topo quando o app está sem rede (ADR-012): a casca abre pelo
 * service worker, mas os dados vêm só da API — o que está na tela é o que
 * já tinha sido carregado. Ver `useOnline` (navegador offline ou chamada à
 * API que falhou por rede). Visual do protótipo (Etapa 8): vermelho suave
 * com o texto vermelho escuro (5,6:1) e o ícone na linha do texto.
 */
export function AvisoSemRede() {
  const online = useOnline();
  if (online) return null;
  return (
    <p
      className="flex items-center justify-center gap-2 border-b border-st-red/40 bg-st-red-soft px-4 py-2 text-sm font-medium text-st-red-text print:hidden"
      role="status"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      Você está sem internet. Os dados mostrados podem estar desatualizados.
    </p>
  );
}

export default AvisoSemRede;
