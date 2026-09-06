import type { Contact } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import * as contactRepository from '../repositories/contact.repository';
import type { CreateContactInput, UpdateContactInput } from '../schemas/contact.schema';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const MENSAGEM_CONTATO_NAO_ENCONTRADO = 'Contato não encontrado.';
const MENSAGEM_PRINCIPAL_OBRIGATORIO =
  'Defina outro contato como principal antes de rebaixar ou remover o contato principal atual.';

export type ContatoDTO = {
  id: string;
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

function toDTO(contact: Contact): ContatoDTO {
  return {
    id: contact.id,
    nome: contact.nome,
    cargo: contact.cargo,
    telefone: contact.telefone,
    email: contact.email,
    principal: contact.principal,
  };
}

export async function createContact(clientId: string, input: CreateContactInput): Promise<ContatoDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  const contato = await contactRepository.createPromovendoPrincipal(clientId, input);
  return toDTO(contato);
}

export async function updateContact(id: string, input: UpdateContactInput): Promise<ContatoDTO> {
  const existente = await contactRepository.findById(id);
  if (!existente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CONTATO_NAO_ENCONTRADO, 404);
  }

  if (existente.principal && input.principal === false) {
    throw new AppError(ErrorCode.PRINCIPAL_OBRIGATORIO, MENSAGEM_PRINCIPAL_OBRIGATORIO, 409);
  }

  const atualizado = await contactRepository.updatePromovendoPrincipal(id, existente.clientId, input);
  return toDTO(atualizado);
}

export async function deleteContact(id: string): Promise<void> {
  const existente = await contactRepository.findById(id);
  if (!existente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CONTATO_NAO_ENCONTRADO, 404);
  }

  if (existente.principal) {
    throw new AppError(ErrorCode.PRINCIPAL_OBRIGATORIO, MENSAGEM_PRINCIPAL_OBRIGATORIO, 409);
  }

  await contactRepository.remove(id);
}
