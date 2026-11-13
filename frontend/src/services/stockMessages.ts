/**
 * Acesso tipado à proposta da mensagem de consulta de estoque (nada é gravado).
 * Espelha o DTO de `backend/src/services/stock-message.service.ts`.
 */
import { api } from './api';

export type Proposta = {
  evento: { id: string; nome: string; produtosSugeridos: string[] } | null;
  contatos: { id: string; nome: string; telefone: string; principal: boolean }[];
  telefoneCliente: string;
  textoSugerido: string;
  textosSugeridos: { contactId: string | null; texto: string }[];
};

export function buscarProposta(clienteId: string): Promise<Proposta> {
  return api.get<Proposta>(`/clients/${clienteId}/stock-message/proposta`);
}
