import type { Role } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';

/**
 * Regra de carteira (spec da Etapa 7, 5.0): o representante só enxerga e
 * altera clientes da própria carteira (`Client.representanteId`); o gestor
 * enxerga todos. Módulo sem dependência de repositório nem de ERP para que
 * qualquer service (inclusive `erp.service`, de quem `client.service`
 * depende) aplique a mesma regra sem import circular. `client.service`
 * reexporta o que é público aqui.
 */

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const MENSAGEM_CLIENTE_DE_OUTRA_CARTEIRA = 'Cliente de outra carteira.';

export type UsuarioAutenticado = { id: string; role: Role };

/** Verdadeiro só para o representante diante de cliente de outra carteira. */
export function ehDeOutraCarteira(cliente: { representanteId: string }, usuario: UsuarioAutenticado): boolean {
  return usuario.role === 'REPRESENTANTE' && cliente.representanteId !== usuario.id;
}

/**
 * Regra de carteira para escrita (403). O gestor passa direto: as rotas de
 * escrita que ele não pode usar já barram em `requireRole`. Chamada logo
 * após confirmar que o cliente existe.
 */
export function exigirClienteDaCarteira(cliente: { representanteId: string }, usuario: UsuarioAutenticado): void {
  if (ehDeOutraCarteira(cliente, usuario)) {
    throw new AppError(ErrorCode.FORBIDDEN, MENSAGEM_CLIENTE_DE_OUTRA_CARTEIRA, 403);
  }
}

/**
 * Regra de carteira para leitura (404): cliente inexistente e cliente de
 * outra carteira (para o representante) respondem igual, para que a
 * resposta não revele que o cliente existe. Devolve o cliente já sem `null`.
 */
export function exigirClienteVisivel<T extends { representanteId: string }>(
  cliente: T | null,
  usuario: UsuarioAutenticado,
): T {
  if (!cliente || ehDeOutraCarteira(cliente, usuario)) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  return cliente;
}

/**
 * Carteira a filtrar nas visões agregadas (lista de clientes, agenda,
 * indicadores, alertas): o representante sempre a própria, ignorando o que
 * pedir; o gestor a do `representanteId` solicitado ou, sem ele, todas
 * (`undefined`). Não valida se o solicitado existe: id desconhecido apenas
 * não casa com nenhum cliente.
 */
export function representanteEfetivo(usuario: UsuarioAutenticado, solicitado?: string): string | undefined {
  return usuario.role === 'REPRESENTANTE' ? usuario.id : solicitado;
}
