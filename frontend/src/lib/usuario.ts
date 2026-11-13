/**
 * Regra do usuário de login no front (criar e editar conta), espelhando o
 * backend (`usuarioSchema`): de 3 a 30 letras minúsculas, números, ponto,
 * hífen ou sublinhado, conferidos depois de aparar e passar para minúsculas.
 */
const USUARIO_REGEX = /^[a-z0-9._-]{3,30}$/;

export const MENSAGEM_USUARIO_INVALIDO =
  'Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.';

/** O usuário como o backend o grava: sem espaços nas pontas e em minúsculas. */
export function normalizarUsuario(texto: string): string {
  return texto.trim().toLowerCase();
}

export function usuarioValido(texto: string): boolean {
  return USUARIO_REGEX.test(normalizarUsuario(texto));
}
