/**
 * Conferência simples de formato de e-mail (algo@algo.algo), a mesma das
 * outras validações do front; a palavra final é do zod do backend.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValido(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}
