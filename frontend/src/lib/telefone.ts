/**
 * Telefone para os atalhos de contato da ficha (Etapa 7, spec 5.5): links
 * `tel:` e `https://wa.me/`, que exigem o número internacional só com
 * dígitos, e o link do WhatsApp com a mensagem já preenchida (mesmo formato e
 * mesmas regras de validação do link que o backend monta em
 * `stock-message.template.ts`). Funções puras.
 */

const CODIGO_BRASIL = '55';

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
 * Número para o `wa.me` com as mesmas regras de `normalizarTelefone` do
 * backend: só dígitos; rejeita prefixo não geográfico (nos dígitos brutos,
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
 * tamanho inválido) devolve vazio, como o backend recusa gerar o link.
 */
export function linkWhatsapp(telefone: string, texto?: string): string {
  const numero = numeroParaWhatsapp(telefone);
  if (numero === '') {
    return '';
  }
  const link = `https://wa.me/${numero}`;
  return texto ? `${link}?text=${encodeURIComponent(texto)}` : link;
}
