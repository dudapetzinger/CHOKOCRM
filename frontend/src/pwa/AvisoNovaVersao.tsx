import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

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

  // Faixa branca: o "Atualizar" em text-primary passa no contraste (4,6:1) só sobre branco (spec 6.3)
  return (
    <p
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b bg-card px-4 py-1 text-sm text-foreground print:hidden"
      role="status"
    >
      <span className="inline-flex items-center gap-2">
        <RefreshCw aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        Nova versão disponível
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="px-2 text-sm font-semibold underline"
        onClick={atualizar}
      >
        Atualizar
      </Button>
    </p>
  );
}

export default AvisoNovaVersao;
