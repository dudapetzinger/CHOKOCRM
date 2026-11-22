import { useCallback, useState } from 'react';

const PREFIXO = 'chokocrm:bloco-recolhido:';

/**
 * Lê a escolha guardada ('1' recolhido, '0' aberto); sem escolha, ou sem
 * armazenamento disponível, vale o estado de início do bloco.
 */
function lerRecolhido(id: string, recolhidoDeInicio: boolean): boolean {
  try {
    const guardado = window.localStorage.getItem(PREFIXO + id);
    if (guardado === '1') return true;
    if (guardado === '0') return false;
    return recolhidoDeInicio;
  } catch {
    return recolhidoDeInicio;
  }
}

/**
 * Guarda a escolha no navegador, só quando difere do estado de início;
 * falha em silêncio quando o armazenamento não está disponível.
 */
function gravarRecolhido(id: string, recolhido: boolean, recolhidoDeInicio: boolean): void {
  try {
    if (recolhido === recolhidoDeInicio) {
      window.localStorage.removeItem(PREFIXO + id);
    } else {
      window.localStorage.setItem(PREFIXO + id, recolhido ? '1' : '0');
    }
  } catch {
    // Sem armazenamento, a escolha vale só enquanto a tela está aberta.
  }
}

/**
 * Estado aberto ou recolhido de um bloco, guardado por identificador. Sem
 * identificador, o bloco não recolhe e fica sempre aberto. Com
 * `recolhidoDeInicio`, o bloco começa recolhido até a pessoa abrir.
 */
export function useBlocoRecolhivel(
  id: string | undefined,
  recolhidoDeInicio = false,
): {
  aberto: boolean;
  alternar: () => void;
  expandir: () => void;
} {
  const [recolhido, setRecolhido] = useState<boolean>(() => (id ? lerRecolhido(id, recolhidoDeInicio) : false));

  const definir = useCallback(
    (valor: boolean) => {
      setRecolhido(valor);
      if (id) gravarRecolhido(id, valor, recolhidoDeInicio);
    },
    [id, recolhidoDeInicio],
  );

  return {
    aberto: !id || !recolhido,
    alternar: () => definir(!recolhido),
    expandir: () => definir(false),
  };
}
