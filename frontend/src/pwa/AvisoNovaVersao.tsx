import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registra o service worker e avisa quando há versão nova (ADR-012).
 *
 * Com `registerType: 'autoUpdate'` (vite.config.ts) o service worker novo
 * se instala e assume sozinho; o padrão do plugin seria então recarregar a
 * página na hora — o que apagaria um check-in sendo digitado. O
 * `onNeedReload` troca esse recarregamento por este aviso, e quem decide o
 * momento é o representante. O `needRefresh` só acende no modo `prompt`;
 * fica tratado caso o modo mude.
 */
export function AvisoNovaVersao() {
  const [recarregar, setRecarregar] = useState(false);
  const {
    needRefresh: [precisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({ onNeedReload: () => setRecarregar(true) });

  if (!recarregar && !precisaAtualizar) return null;

  function atualizar() {
    if (precisaAtualizar) {
      void updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  }

  return (
    <p className="aviso aviso-nova-versao" role="status">
      <span>Nova versão disponível</span>
      <button type="button" className="btn-link-aviso" onClick={atualizar}>
        Atualizar
      </button>
    </p>
  );
}

export default AvisoNovaVersao;
