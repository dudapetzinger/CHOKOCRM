import { createHash, randomBytes } from 'node:crypto';

/**
 * Regras do link de redefinição de senha (spec da Etapa 8, 7.13). O token
 * vai só no e-mail; o banco guarda apenas o hash SHA-256, e a busca do
 * token recebido é feita pelo hash (consulta por igualdade no índice
 * único), sem comparar segredos em texto.
 */

/** O link vale 24 h: a representante pode ver o e-mail só no fim do dia em campo. */
export const VALIDADE_TOKEN_HORAS = 24;

const BYTES_DO_TOKEN = 32;
const MS_POR_HORA = 3_600_000;

/** SHA-256 em hexadecimal: o que o banco guarda e por onde o token é procurado. */
export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 32 bytes aleatórios em base64url (43 caracteres, seguro na URL) e o hash a gravar. */
export function gerarTokenDeRedefinicao(): { token: string; tokenHash: string } {
  const token = randomBytes(BYTES_DO_TOKEN).toString('base64url');
  return { token, tokenHash: hashDoToken(token) };
}

export function expiracaoDoToken(agora: Date): Date {
  return new Date(agora.getTime() + VALIDADE_TOKEN_HORAS * MS_POR_HORA);
}

/** Vale uma vez só e até o instante da expiração, inclusive. */
export function tokenAindaVale(registro: { expiraEm: Date; usadoEm: Date | null }, agora: Date): boolean {
  return registro.usadoEm === null && agora.getTime() <= registro.expiraEm.getTime();
}
