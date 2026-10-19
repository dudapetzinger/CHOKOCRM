import { Aviso } from './crm/ui';

/**
 * O que o representante vê ao abrir uma tela do gestor pelo endereço (a aba
 * não aparece na navegação dele; o backend recusa as chamadas de qualquer
 * jeito).
 */
export function AvisoExclusivoDoGestor() {
  return (
    <Aviso tom="atencao" role="alert">
      Esta tela é exclusiva do gestor.
    </Aviso>
  );
}
