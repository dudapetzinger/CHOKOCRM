/**
 * O app tem rede? (ADR-012) `false` quando o navegador diz que está offline
 * (`navigator.onLine` + eventos `online`/`offline`) ou quando a última
 * chamada à API falhou por rede (`estadoRede`, registrado por
 * `services/api.ts`) — com Wi-Fi sem internet o `navigator.onLine` continua
 * `true`. O evento `online` limpa a falha da API: a próxima chamada confirma.
 */
import { useSyncExternalStore } from 'react';
import { assinarEstadoRede, registrarRespostaDaApi, semRedeNaApi } from './estadoRede';

function navegadorOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function assinar(aoMudar: () => void): () => void {
  const aoVoltar = () => {
    registrarRespostaDaApi();
    aoMudar();
  };
  window.addEventListener('online', aoVoltar);
  window.addEventListener('offline', aoMudar);
  const cancelarEstadoRede = assinarEstadoRede(aoMudar);
  return () => {
    window.removeEventListener('online', aoVoltar);
    window.removeEventListener('offline', aoMudar);
    cancelarEstadoRede();
  };
}

function estaOnline(): boolean {
  return navegadorOnline() && !semRedeNaApi();
}

export function useOnline(): boolean {
  return useSyncExternalStore(assinar, estaOnline, () => true);
}
