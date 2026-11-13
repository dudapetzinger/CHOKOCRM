/**
 * Contatos que podem receber WhatsApp: só os de telefone que serve para o
 * `wa.me` (ver `linkWhatsapp`), o principal primeiro e depois por nome. É a
 * regra única do cabeçalho da ficha e do cartão de mensagem de estoque.
 */
import type { Proposta } from '../services/stockMessages';
import { linkWhatsapp } from './telefone';

export function contatosParaWhatsapp<T extends { nome: string; telefone: string; principal: boolean }>(
  contatos: T[],
): T[] {
  return contatos
    .filter((contato) => linkWhatsapp(contato.telefone) !== '')
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Texto sugerido para o destino: o do contato, se a proposta trouxer, senão o geral. `contactId` é `null` no telefone do cliente. */
export function textoSugeridoDoDestino(proposta: Proposta, contactId: string | null): string {
  return proposta.textosSugeridos.find((item) => item.contactId === contactId)?.texto ?? proposta.textoSugerido;
}
