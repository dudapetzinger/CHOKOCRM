/**
 * Telefone para os atalhos de contato da ficha: links
 * `tel:` e `https://wa.me/`, que exigem o número internacional só com
 * dígitos, e o link do WhatsApp com a mensagem já preenchida.
 *
 * Com `VITE_TELEFONE_DE_TESTE` definido, os links de ligação e de WhatsApp
 * de qualquer cliente vão para esse número, e os telefones cadastrados ficam
 * como estão. Serve para os testes com pessoas de fora não chegarem aos
 * clientes de verdade. O telefone cadastrado continua decidindo se há link:
 * o que não serve (sem DDD, 0800) segue sem link. Com o telefone de teste
 * inválido, nenhum link é montado.
 */

const CODIGO_BRASIL = '55';

/** Telefone de teste definido em `VITE_TELEFONE_DE_TESTE`, ou vazio. */
export function telefoneDeTeste(): string {
  return String(import.meta.env.VITE_TELEFONE_DE_TESTE ?? '').trim();
}

export function somenteDigitos(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

/**
 * Número internacional (55 + DDD + número) só com dígitos, ou vazio se não
 * houver dígitos; um único zero inicial (tronco, "047 …") é descartado. Um número nacional tem 10–11 dígitos; com 12–13 dígitos e
 * começando por 55, já vem com o código do país e não ganha outro (assim o
 * DDD 55, do RS, sem código do país continua recebendo o prefixo).
 */
export function telefoneParaWaMe(telefone: string): string {
  // Zero de tronco ("047 99900-8080", "(047) 3333-4444"): não faz parte do número.
  const digitos = somenteDigitos(telefone).replace(/^0/, '');
  if (digitos === '') {
    return '';
  }
  const jaInternacional = digitos.startsWith(CODIGO_BRASIL) && digitos.length >= 12 && digitos.length <= 13;
  return jaInternacional ? digitos : `${CODIGO_BRASIL}${digitos}`;
}

/** Prefixos não geográficos (0800, 0300, 0500, 0900), nunca um WhatsApp válido. */
const REGEX_PREFIXO_NAO_GEOGRAFICO = /^0[3589]00/;

/**
 * Número para o `wa.me`: só dígitos; rejeita prefixo não geográfico (nos dígitos brutos,
 * antes de tirar o zero de tronco); remove zeros iniciais; 10–11 dígitos
 * ganham o 55 e 12–13 dígitos precisam começar com 55. Qualquer outro caso
 * (sem DDD, tamanho estranho) devolve vazio.
 */
function numeroParaWhatsapp(telefone: string): string {
  const digitosComTronco = somenteDigitos(telefone);
  if (REGEX_PREFIXO_NAO_GEOGRAFICO.test(digitosComTronco)) {
    return '';
  }
  const digitos = digitosComTronco.replace(/^0+/, '');
  if (digitos.length >= 10 && digitos.length <= 11) {
    return `${CODIGO_BRASIL}${digitos}`;
  }
  if (digitos.length >= 12 && digitos.length <= 13 && digitos.startsWith(CODIGO_BRASIL)) {
    return digitos;
  }
  return '';
}

/**
 * Link `https://wa.me/<número>` do telefone, com `?text=<texto codificado>`
 * quando há texto; telefone que não serve para o WhatsApp (sem DDD, 0800,
 * tamanho inválido) devolve vazio.
 */
export function linkWhatsapp(telefone: string, texto?: string): string {
  if (numeroParaWhatsapp(telefone) === '') {
    return '';
  }
  const teste = telefoneDeTeste();
  const numero = numeroParaWhatsapp(teste === '' ? telefone : teste);
  if (numero === '') {
    return '';
  }
  const link = `https://wa.me/${numero}`;
  return texto ? `${link}?text=${encodeURIComponent(texto)}` : link;
}

/**
 * Link `tel:+<número internacional>` do telefone, ou vazio quando não há
 * dígitos.
 */
export function linkLigar(telefone: string): string {
  if (telefoneParaWaMe(telefone) === '') {
    return '';
  }
  const teste = telefoneDeTeste();
  if (teste !== '' && numeroParaWhatsapp(teste) === '') {
    return '';
  }
  return `tel:+${telefoneParaWaMe(teste === '' ? telefone : teste)}`;
}
