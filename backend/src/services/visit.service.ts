import type { ResultadoVisita } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { detectarImagem } from '../lib/imageType';
import { fileStorage } from '../storage';
import * as clientRepository from '../repositories/client.repository';
import * as visitRepository from '../repositories/visit.repository';
import type { VisitComRelacoes } from '../repositories/visit.repository';
import type { CreateVisitInput, UpdateVisitInput } from '../schemas/visit.schema';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const MENSAGEM_CLIENTE_INATIVO = 'Cliente inativo não recebe check-in.';
const MENSAGEM_CONTATO_DE_OUTRO_CLIENTE = 'Contato informado não pertence a este cliente.';
const MENSAGEM_VISITA_NAO_ENCONTRADA = 'Visita não encontrada.';
const MENSAGEM_APENAS_AUTOR = 'Apenas o autor do check-in pode alterá-lo.';
const MENSAGEM_FOTO_JA_EXISTE = 'Esta visita já tem foto de comprovação.';
const MENSAGEM_FOTO_INVALIDA = 'O arquivo enviado não é uma imagem JPEG, PNG ou WebP.';
const MENSAGEM_SEM_FOTO = 'Esta visita não tem foto de comprovação.';

export type VisitaDTO = {
  id: string;
  dataHora: string;
  descricao: string;
  resultado: ResultadoVisita;
  contato: { id: string; nome: string } | null;
  autor: { id: string; nome: string };
  temFoto: boolean;
  criadoEm: string;
  editadoEm: string | null;
};

/**
 * O DTO expõe `temFoto`, e nunca o `fotoPath`: a chave interna do
 * armazenamento não é assunto do cliente HTTP — a foto é lida pela rota
 * `GET /visits/:id/foto`, autenticada como as demais.
 */
export function toVisitaDTO(visit: VisitComRelacoes): VisitaDTO {
  return {
    id: visit.id,
    dataHora: visit.dataHora.toISOString(),
    descricao: visit.descricao,
    resultado: visit.resultado,
    contato: visit.contact ? { id: visit.contact.id, nome: visit.contact.nome } : null,
    autor: { id: visit.user.id, nome: visit.user.nome },
    temFoto: visit.fotoPath !== null,
    criadoEm: visit.criadoEm.toISOString(),
    editadoEm: visit.editadoEm ? visit.editadoEm.toISOString() : null,
  };
}

async function exigirClienteAtivo(clientId: string): Promise<void> {
  const cliente = await clientRepository.findById(clientId);

  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  if (!cliente.ativo) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_CLIENTE_INATIVO, 409);
  }
}

/**
 * A leitura da timeline **não** exige cliente ativo: o histórico de um
 * cliente inativado continua legível (e editável pelo autor); o que se
 * bloqueia é check-in novo em carteira desativada.
 */
async function exigirClienteExistente(clientId: string): Promise<void> {
  const cliente = await clientRepository.findById(clientId);

  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }
}

export async function listVisitsByClient(clientId: string): Promise<VisitaDTO[]> {
  await exigirClienteExistente(clientId);

  const visitas = await visitRepository.listByClient(clientId);
  return visitas.map(toVisitaDTO);
}

export async function createVisit(
  clientId: string,
  userId: string,
  input: CreateVisitInput,
): Promise<VisitaDTO> {
  await exigirClienteAtivo(clientId);

  if (input.contactId) {
    const pertence = await visitRepository.contatoPertenceAoCliente(input.contactId, clientId);
    if (!pertence) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CONTATO_DE_OUTRO_CLIENTE, 400);
    }
  }

  const visita = await visitRepository.create({
    clientId,
    userId,
    contactId: input.contactId,
    dataHora: input.dataHora ?? new Date(),
    descricao: input.descricao,
    resultado: input.resultado,
  });

  return toVisitaDTO(visita);
}

async function exigirVisitaDoAutor(visitId: string, userId: string): Promise<VisitComRelacoes> {
  const visita = await visitRepository.findById(visitId);

  if (!visita) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_VISITA_NAO_ENCONTRADA, 404);
  }

  if (visita.userId !== userId) {
    throw new AppError(ErrorCode.FORBIDDEN, MENSAGEM_APENAS_AUTOR, 403);
  }

  return visita;
}

export async function updateDescricao(
  visitId: string,
  userId: string,
  input: UpdateVisitInput,
): Promise<VisitaDTO> {
  await exigirVisitaDoAutor(visitId, userId);

  const visita = await visitRepository.updateDescricao(visitId, input.descricao);
  return toVisitaDTO(visita);
}

export async function anexarFoto(visitId: string, userId: string, conteudo: Buffer): Promise<VisitaDTO> {
  const visita = await exigirVisitaDoAutor(visitId, userId);

  if (visita.fotoPath !== null) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_FOTO_JA_EXISTE, 409);
  }

  const formato = detectarImagem(conteudo);
  if (!formato) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_FOTO_INVALIDA, 400);
  }

  const chave = `visits/${visitId}.${formato.extensao}`;
  await fileStorage.save(chave, conteudo, formato.contentType);

  const atualizada = await visitRepository.setFotoPath(visitId, chave);
  return toVisitaDTO(atualizada);
}

export async function lerFoto(visitId: string): Promise<{ conteudo: Buffer; contentType: string }> {
  const visita = await visitRepository.findById(visitId);

  if (!visita) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_VISITA_NAO_ENCONTRADA, 404);
  }

  if (visita.fotoPath === null) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_SEM_FOTO, 404);
  }

  // Arquivo ausente no armazenamento (volume novo, restauração só do
  // banco) já chega como AppError 404 do driver — não vaza como 500.
  return fileStorage.read(visita.fotoPath);
}
