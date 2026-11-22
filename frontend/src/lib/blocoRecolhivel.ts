import { useCallback, useState } from 'react';

const PREFIXO = 'chokocrm:bloco-recolhido:';

/** Lê se o bloco foi recolhido; sem armazenamento disponível, o bloco fica aberto. */
function lerRecolhido(id: string): boolean {
  try {
    return window.localStorage.getItem(PREFIXO + id) === '1';
  } catch {
    return false;
  }
}

/** Guarda a escolha no navegador; falha em silêncio quando o armazenamento não está disponível. */
function gravarRecolhido(id: string, recolhido: boolean): void {
  try {
    if (recolhido) {
      window.localStorage.setItem(PREFIXO + id, '1');
    } else {
      window.localStorage.removeItem(PREFIXO + id);
    }
  } catch {
    // Sem armazenamento, a escolha vale só enquanto a tela está aberta.
  }
}

/**
 * Estado aberto ou recolhido de um bloco, guardado por identificador. Sem
 * identificador, o bloco não recolhe e fica sempre aberto.
 */
export function useBlocoRecolhivel(id: string | undefined): {
  aberto: boolean;
  alternar: () => void;
  expandir: () => void;
} {
  const [recolhido, setRecolhido] = useState<boolean>(() => (id ? lerRecolhido(id) : false));

  const definir = useCallback(
    (valor: boolean) => {
      setRecolhido(valor);
      if (id) gravarRecolhido(id, valor);
    },
    [id],
  );

  return {
    aberto: !id || !recolhido,
    alternar: () => definir(!recolhido),
    expandir: () => definir(false),
  };
}
