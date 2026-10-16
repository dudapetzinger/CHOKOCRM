/**
 * Telefone para os atalhos de contato da ficha (Etapa 7, spec 5.5): links
 * `tel:` e `https://wa.me/`, que exigem o número internacional só com
 * dígitos. Funções puras.
 */

const CODIGO_BRASIL = '55';

export function somenteDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

/**
 * Número internacional (55 + DDD + número) só com dígitos, ou vazio se não
 * houver dígitos. Um número nacional tem 10–11 dígitos; com 12–13 dígitos e
 * começando por 55, já vem com o código do país e não ganha outro (assim o
 * DDD 55, do RS, sem código do país continua recebendo o prefixo).
 */
export function telefoneParaWaMe(telefone: string): string {
  const digitos = somenteDigitos(telefone);
  if (digitos === '') {
    return '';
  }
  const jaInternacional = digitos.startsWith(CODIGO_BRASIL) && digitos.length >= 12 && digitos.length <= 13;
  return jaInternacional ? digitos : `${CODIGO_BRASIL}${digitos}`;
}
