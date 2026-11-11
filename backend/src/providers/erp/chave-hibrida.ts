/**
 * Chave do cliente no provedor `hibrido`: o CNPJ (só dígitos) e o `erpId`
 * numa string só, `cnpj|erpId` (`erpId` vazio quando o cliente não tem). Uma
 * string, e não um objeto, para os lotes do `erp.service` (que deduplicam
 * chaves com `Set`/`Map`) continuarem como estão. Quem monta é
 * `erp.service.chaveDoCliente`; quem desmonta é `HibridoErpProvider`, que
 * repassa o CNPJ ao provedor das notas ou o `erpId` ao simulado.
 */
const SEPARADOR = '|';

export function chaveHibrida(cnpj: string, erpId: string | null): string {
  return `${cnpj}${SEPARADOR}${erpId ?? ''}`;
}

/** Inverso de `chaveHibrida`: `erpId` vazio volta como `null`. */
export function decomporChaveHibrida(chave: string): { cnpj: string; erpId: string | null } {
  const posicao = chave.indexOf(SEPARADOR);
  if (posicao === -1) {
    return { cnpj: chave, erpId: null };
  }
  const erpId = chave.slice(posicao + 1);
  return { cnpj: chave.slice(0, posicao), erpId: erpId || null };
}
