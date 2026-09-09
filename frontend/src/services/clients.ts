/**
 * Acesso tipado à API de clientes/contatos do ChokoCRM (UC02/UC03/UC04).
 *
 * Espelha os DTOs de `backend/src/services/client.service.ts` e
 * `contact.service.ts`. Além das chamadas HTTP, concentra aqui a validação
 * client-side dos dados do cliente (mesmas regras do zod em
 * `backend/src/schemas/client.schema.ts`) e o utilitário de mensagem de erro
 * amigável, reaproveitados por `NovoClientePage` e `ClienteDetalhePage`.
 * A validação/estado dos contatos fica em `components/ContatoFields.tsx`.
 */
import { api, ApiError } from './api';

export type Contato = {
  id: string;
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

export type ClienteListItem = {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cidade: string;
  telefone: string;
  ativo: boolean;
  contatoPrincipal: { nome: string; telefone: string } | null;
};

export type ClienteCompleto = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  erpId: string | null;
  recorrenciaDias: number;
  ativo: boolean;
  criadoEm: string;
  contatos: Contato[];
};

export type ContatoInput = {
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

export type CreateClienteInput = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  erpId?: string;
  recorrenciaDias?: number;
  contatos: ContatoInput[];
};

export type UpdateClienteInput = Partial<{
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  erpId: string;
  recorrenciaDias: number;
  ativo: boolean;
}>;

export type UpdateContatoInput = Partial<ContatoInput>;

type ListClientsResponse = { data: ClienteListItem[] };

export function listClients(params: { search?: string } = {}): Promise<ClienteListItem[]> {
  const query = new URLSearchParams();
  if (params.search) {
    query.set('search', params.search);
  }
  const qs = query.toString();
  return api.get<ListClientsResponse>(`/clients${qs ? `?${qs}` : ''}`).then((resposta) => resposta.data);
}

export function getCliente(id: string): Promise<ClienteCompleto> {
  return api.get<ClienteCompleto>(`/clients/${id}`);
}

export function createCliente(input: CreateClienteInput): Promise<ClienteCompleto> {
  return api.post<ClienteCompleto>('/clients', input);
}

export function updateCliente(id: string, input: UpdateClienteInput): Promise<ClienteCompleto> {
  return api.put<ClienteCompleto>(`/clients/${id}`, input);
}

export function createContato(clienteId: string, input: ContatoInput): Promise<Contato> {
  return api.post<Contato>(`/clients/${clienteId}/contacts`, input);
}

export function updateContato(id: string, input: UpdateContatoInput): Promise<Contato> {
  return api.put<Contato>(`/contacts/${id}`, input);
}

export function deleteContato(id: string): Promise<void> {
  return api.del<void>(`/contacts/${id}`);
}

/**
 * Extrai uma mensagem amigável (em português) de um erro de API para
 * exibição direta ao usuário. Quando o erro traz `details` no formato de
 * issues do zod (`{ path, message }[]`, ver `errorHandler.ts`), concatena as
 * mensagens de cada campo; caso contrário usa a mensagem principal do erro
 * (já amigável nos `AppError` de negócio, como CNPJ duplicado ou o
 * PRINCIPAL_OBRIGATORIO).
 */
export function mensagemErroApi(erro: unknown, padrao: string): string {
  if (erro instanceof ApiError) {
    if (Array.isArray(erro.details) && erro.details.length > 0) {
      const mensagens = erro.details
        .map((item) =>
          item && typeof item === 'object' && 'message' in item
            ? String((item as { message?: unknown }).message)
            : null,
        )
        .filter((mensagem): mensagem is string => Boolean(mensagem));
      if (mensagens.length > 0) {
        return mensagens.join(' ');
      }
    }
    return erro.message;
  }
  return padrao;
}

/** Campos do cliente controlados como texto no formulário (novo/edição). */
export type DadosClienteFormulario = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  erpId: string;
  recorrenciaDias: string;
};

export type ErrosDadosCliente = Partial<Record<keyof DadosClienteFormulario, string>>;

export function dadosClienteVazios(): DadosClienteFormulario {
  return {
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    cidade: '',
    endereco: '',
    telefone: '',
    email: '',
    erpId: '',
    recorrenciaDias: '',
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CNPJ_REGEX = /^\d{14}$/;

/**
 * Validação client-side dos campos do cliente, espelhando
 * `createClientSchema`/`updateClientSchema` (zod). Não substitui a validação
 * do backend — apenas evita idas e vindas desnecessárias à API.
 */
export function validarDadosCliente(dados: DadosClienteFormulario): ErrosDadosCliente {
  const erros: ErrosDadosCliente = {};

  if (!dados.razaoSocial.trim()) erros.razaoSocial = 'Razão social é obrigatória.';
  if (!dados.nomeFantasia.trim()) erros.nomeFantasia = 'Nome fantasia é obrigatório.';
  if (!CNPJ_REGEX.test(dados.cnpj.trim())) erros.cnpj = 'CNPJ deve conter 14 dígitos numéricos.';
  if (!dados.cidade.trim()) erros.cidade = 'Cidade é obrigatória.';
  if (!dados.endereco.trim()) erros.endereco = 'Endereço é obrigatório.';
  if (!dados.telefone.trim()) erros.telefone = 'Telefone é obrigatório.';
  if (!EMAIL_REGEX.test(dados.email.trim())) erros.email = 'E-mail inválido.';

  if (dados.recorrenciaDias.trim()) {
    const numero = Number(dados.recorrenciaDias);
    if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
      erros.recorrenciaDias = 'Recorrência de visitas deve ser um número inteiro entre 1 e 365.';
    }
  }

  return erros;
}

/** Converte os campos de texto do formulário para o payload aceito pela API. */
export function normalizarDadosCliente(
  dados: DadosClienteFormulario,
): Omit<CreateClienteInput, 'contatos'> {
  return {
    razaoSocial: dados.razaoSocial.trim(),
    nomeFantasia: dados.nomeFantasia.trim(),
    cnpj: dados.cnpj.trim(),
    cidade: dados.cidade.trim(),
    endereco: dados.endereco.trim(),
    telefone: dados.telefone.trim(),
    email: dados.email.trim(),
    ...(dados.erpId.trim() ? { erpId: dados.erpId.trim() } : {}),
    ...(dados.recorrenciaDias.trim() ? { recorrenciaDias: Number(dados.recorrenciaDias) } : {}),
  };
}
