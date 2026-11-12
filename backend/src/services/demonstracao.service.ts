import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { agora, carregarRelogio, definirDemonstracao, estadoDoRelogio, type RelogioEstado } from '../lib/relogio';
import {
  type LinhaDemonstracao,
  lerLinhaDemonstracao,
  restaurarLinhaDemonstracao,
} from '../repositories/configuracao.repository';
import { reiniciarDemonstracao } from '../seed/demonstracao';
import type { DataCalendario } from './classificacao.service';
import { conferirCredenciais } from './auth.service';

/**
 * Modo demonstração acionado da tela de login (`POST /sistema/demonstracao`,
 * público): confere e-mail e senha (`conferirCredenciais`, a mesma checagem
 * do login, sem emitir token), exige a conta Gestão ativa, grava a data (ou a
 * limpa, com `null`) e recria a demonstração nessa data com
 * `reiniciarDemonstracao` (apaga só os clientes da demonstração, com visitas,
 * pedidos etc., e mantém os clientes reais e as contas). Uma recriação por vez:
 * um mutex em memória (a API roda numa
 * instância só) recusa a segunda chamada com 409 até a primeira terminar,
 * dando certo ou não. O mutex é tomado depois da autenticação, então quem não
 * sabe a senha não descobre se há uma recriação em andamento. Se a recriação
 * falha (a transação do seed desfaz os dados), a configuração volta a ser a
 * de antes (a linha como estava, ou nenhuma) e o relógio é recarregado: o app
 * nunca fica numa data cujos dados não existem.
 */
const MENSAGEM_SO_GESTAO = 'Só a conta Gestão pode fazer isso.';
const MENSAGEM_EM_ANDAMENTO = 'Já existe uma recriação em andamento.';

let recriando = false;

export async function recriarDemonstracao(
  data: DataCalendario | null,
  email: string,
  senha: string,
): Promise<RelogioEstado> {
  const usuario = await conferirCredenciais(email, senha);
  if (usuario.role !== 'GESTOR' || !usuario.ativo) {
    throw new AppError(ErrorCode.FORBIDDEN, MENSAGEM_SO_GESTAO, 403);
  }
  if (recriando) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_EM_ANDAMENTO, 409);
  }

  recriando = true;
  try {
    const anterior = await lerLinhaDemonstracao();
    await definirDemonstracao(data, usuario.id);
    try {
      await reiniciarDemonstracao(prisma, agora());
    } catch (err) {
      await restaurarConfiguracao(anterior);
      throw err;
    }
    return estadoDoRelogio();
  } finally {
    recriando = false;
  }
}

/**
 * Desfaz a gravação da data depois de uma recriação que falhou. Se até a
 * restauração falhar, registra e segue: o erro devolvido é o da recriação.
 */
async function restaurarConfiguracao(anterior: LinhaDemonstracao | null): Promise<void> {
  try {
    await restaurarLinhaDemonstracao(anterior);
    await carregarRelogio();
  } catch (erroAoRestaurar) {
    logger.error({ err: erroAoRestaurar }, 'Falha ao restaurar a configuração do modo demonstração');
  }
}
