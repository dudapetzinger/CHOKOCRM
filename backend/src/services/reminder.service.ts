import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import * as reminderRepository from '../repositories/reminder.repository';
import { ehDeOutraCarteira, exigirClienteVisivel, type UsuarioAutenticado } from './carteira';
import { dataCalendario } from './classificacao.service';
import { toLembreteDTO, type LembreteDTO } from './lembrete.dto';

/**
 * Lembrete como tarefa própria (Etapa 9): criado no check-in, listado na
 * ficha do cliente (só os abertos) e concluído pelo dono da carteira ou pelo
 * gestor. A regra de carteira segue o dono atual do cliente: se o cliente for
 * transferido, o lembrete vai junto.
 */

const MENSAGEM_LEMBRETE_NAO_ENCONTRADO = 'Lembrete não encontrado.';
const MENSAGEM_LEMBRETE_JA_CONCLUIDO = 'Lembrete já concluído.';

export { toLembreteDTO, type LembreteDTO };

/** Cliente inexistente ou de outra carteira (para o representante): 404. */
export async function listarAbertosDoCliente(
  clientId: string,
  usuario: UsuarioAutenticado,
  hoje: Date = new Date(),
): Promise<LembreteDTO[]> {
  exigirClienteVisivel(await clientRepository.findById(clientId), usuario);

  const lembretes = await reminderRepository.listarAbertos({ clientId });
  const dia = dataCalendario(hoje);
  return lembretes.map((lembrete) => toLembreteDTO(lembrete, dia));
}

/**
 * Conclui o lembrete: inexistente ou de cliente de outra carteira (para o
 * representante) responde 404, como se não existisse; já concluído, 409 (a
 * data da conclusão não muda). O gestor conclui o de qualquer carteira.
 */
export async function concluir(
  id: string,
  usuario: UsuarioAutenticado,
  agora: Date = new Date(),
): Promise<{ id: string; concluidoEm: string }> {
  const lembrete = await reminderRepository.findById(id);

  if (!lembrete || ehDeOutraCarteira(lembrete.client, usuario)) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_LEMBRETE_NAO_ENCONTRADO, 404);
  }

  if (lembrete.concluidoEm !== null) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_LEMBRETE_JA_CONCLUIDO, 409);
  }

  await reminderRepository.concluir(id, agora);
  return { id, concluidoEm: agora.toISOString() };
}
