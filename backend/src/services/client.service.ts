import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import type { ClientComContatoPrincipal, ClientComContatos } from '../repositories/client.repository';
import type { CreateClientInput, ListClientsQuery, UpdateClientInput } from '../schemas/client.schema';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const MENSAGEM_CNPJ_DUPLICADO = 'Já existe um cliente cadastrado com este CNPJ.';
const MENSAGEM_CONTATO_PRINCIPAL_UNICO = 'Cadastro exige exatamente um contato marcado como principal.';

export type ClienteListItemDTO = {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cidade: string;
  telefone: string;
  ativo: boolean;
  contatoPrincipal: { nome: string; telefone: string } | null;
};

export type ContatoDTO = {
  id: string;
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

export type ClienteCompletoDTO = {
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
  contatos: ContatoDTO[];
};

function toListItemDTO(client: ClientComContatoPrincipal): ClienteListItemDTO {
  const [principal] = client.contacts;

  return {
    id: client.id,
    nomeFantasia: client.nomeFantasia,
    razaoSocial: client.razaoSocial,
    cidade: client.cidade,
    telefone: client.telefone,
    ativo: client.ativo,
    contatoPrincipal: principal ? { nome: principal.nome, telefone: principal.telefone } : null,
  };
}

function toClienteCompletoDTO(client: ClientComContatos): ClienteCompletoDTO {
  return {
    id: client.id,
    razaoSocial: client.razaoSocial,
    nomeFantasia: client.nomeFantasia,
    cnpj: client.cnpj,
    cidade: client.cidade,
    endereco: client.endereco,
    telefone: client.telefone,
    email: client.email,
    erpId: client.erpId,
    recorrenciaDias: client.recorrenciaDias,
    ativo: client.ativo,
    criadoEm: client.criadoEm.toISOString(),
    contatos: client.contacts.map((contato) => ({
      id: contato.id,
      nome: contato.nome,
      cargo: contato.cargo,
      telefone: contato.telefone,
      email: contato.email,
      principal: contato.principal,
    })),
  };
}

/**
 * Traduz violações de índice único vindas do Postgres (via driver adapter,
 * que embrulha o erro original em `meta.driverAdapterError.cause`) para os
 * códigos de negócio da API: CNPJ duplicado -> 409 CONFLICT; segundo
 * contato principal (índice parcial `one_principal_per_client`) -> 400
 * VALIDATION_ERROR, já que é a mesma regra de negócio validada no zod.
 */
function mapPrismaUniqueError(err: unknown): unknown {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return err;
  }

  const meta = err.meta as
    | { modelName?: string; driverAdapterError?: { cause?: { originalMessage?: string } } }
    | undefined;
  const detalhe = meta?.driverAdapterError?.cause?.originalMessage ?? '';

  if (meta?.modelName === 'Client' || detalhe.includes('cnpj')) {
    return new AppError(ErrorCode.CONFLICT, MENSAGEM_CNPJ_DUPLICADO, 409);
  }

  if (meta?.modelName === 'Contact' || detalhe.includes('one_principal_per_client')) {
    return new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CONTATO_PRINCIPAL_UNICO, 400);
  }

  return err;
}

export async function listClients(query: ListClientsQuery): Promise<ClienteListItemDTO[]> {
  const ativoFiltro = query.ativo === 'todos' ? 'todos' : 'ativos';
  const clientes = await clientRepository.list({ search: query.search, ativoFiltro });
  return clientes.map(toListItemDTO);
}

export async function getClientById(id: string): Promise<ClienteCompletoDTO> {
  const cliente = await clientRepository.findById(id);

  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  return toClienteCompletoDTO(cliente);
}

export async function createClient(input: CreateClientInput): Promise<ClienteCompletoDTO> {
  const cnpjEmUso = await clientRepository.findByCnpj(input.cnpj);
  if (cnpjEmUso) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_CNPJ_DUPLICADO, 409);
  }

  try {
    const id = await clientRepository.createWithContacts(input);
    return await getClientById(id);
  } catch (err) {
    throw mapPrismaUniqueError(err);
  }
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<ClienteCompletoDTO> {
  const existente = await clientRepository.findById(id);
  if (!existente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  if (input.cnpj && input.cnpj !== existente.cnpj) {
    const cnpjEmUso = await clientRepository.findByCnpj(input.cnpj);
    if (cnpjEmUso) {
      throw new AppError(ErrorCode.CONFLICT, MENSAGEM_CNPJ_DUPLICADO, 409);
    }
  }

  try {
    await clientRepository.update(id, input);
  } catch (err) {
    throw mapPrismaUniqueError(err);
  }

  return getClientById(id);
}
