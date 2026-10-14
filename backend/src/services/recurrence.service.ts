import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import type { UpdateRecurrenceInput } from '../schemas/recurrence.schema';
import {
  exigirClienteDaCarteira,
  getClientById,
  type ClienteCompletoDTO,
  type UsuarioAutenticado,
} from './client.service';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
export const MENSAGEM_RECORRENCIA_IGUAL = 'A recorrência informada é igual à atual.';

/**
 * Única forma de alterar `Client.recorrenciaDias` (UC09): a checagem de
 * papel (só REPRESENTANTE) já ocorre em `requireRole` na rota, então este
 * serviço não a repete. Ordem das checagens: cliente existe -> cliente
 * é da carteira do representante -> valor difere do atual -> grava
 * histórico + atualiza em transação.
 */
export async function alterarRecorrencia(
  clientId: string,
  usuario: UsuarioAutenticado,
  input: UpdateRecurrenceInput,
): Promise<ClienteCompletoDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  exigirClienteDaCarteira(cliente, usuario);

  if (input.recorrenciaDias === cliente.recorrenciaDias) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_RECORRENCIA_IGUAL, 400);
  }

  await clientRepository.updateRecorrenciaComHistorico({
    clientId,
    userId: usuario.id,
    anterior: cliente.recorrenciaDias,
    nova: input.recorrenciaDias,
    justificativa: input.justificativa,
  });

  return getClientById(clientId, usuario);
}
