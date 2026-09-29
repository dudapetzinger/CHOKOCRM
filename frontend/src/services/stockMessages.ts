/**
 * Acesso tipado à mensagem de consulta de estoque (UC12, Etapa 6A). Espelha
 * os DTOs de `backend/src/services/stock-message.service.ts`.
 */
import { api } from './api';

export type Proposta = {
  evento: { id: string; nome: string; produtosSugeridos: string[] } | null;
  contatos: { id: string; nome: string; telefone: string; principal: boolean }[];
  telefoneCliente: string;
  textoSugerido: string;
  textosSugeridos: { contactId: string | null; texto: string }[];
};

export type MensagemEstoque = {
  id: string;
  dataGeracao: string;
  textoFinal: string;
  autor: { id: string; nome: string };
  evento: { id: string; nome: string } | null;
  cliente: { id: string; nomeFantasia: string };
};

export type Geracao = MensagemEstoque & {
  contato: { id: string; nome: string } | null;
  telefone: string;
  link: string;
};

export function buscarProposta(clienteId: string): Promise<Proposta> {
  return api.get<Proposta>(`/clients/${clienteId}/stock-message/proposta`);
}

export function gerarMensagem(
  clienteId: string,
  input: { texto: string; contactId?: string },
): Promise<Geracao> {
  return api.post<Geracao>(`/clients/${clienteId}/stock-message`, input);
}

export function listarMensagens(clienteId: string): Promise<MensagemEstoque[]> {
  return api
    .get<{ data: MensagemEstoque[] }>(`/stock-messages?clientId=${clienteId}`)
    .then((resposta) => resposta.data);
}
