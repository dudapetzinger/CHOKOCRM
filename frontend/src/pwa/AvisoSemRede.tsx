import { Icone } from '../components/Icone';
import { useOnline } from './useOnline';

/**
 * Faixa no topo quando o app está sem rede (ADR-012): a casca abre pelo
 * service worker, mas os dados vêm só da API — o que está na tela é o que
 * já tinha sido carregado. Ver `useOnline` (navegador offline ou chamada à
 * API que falhou por rede).
 */
export function AvisoSemRede() {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="aviso aviso-atencao" role="status">
      <Icone nome="wifi-off" tamanho={16} />
      Você está sem internet. Os dados mostrados podem estar desatualizados.
    </p>
  );
}

export default AvisoSemRede;
