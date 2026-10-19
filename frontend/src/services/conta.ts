/**
 * Senha da própria conta (Etapa 8, spec 7.13): trocar estando logado e
 * redefinir pelo link do e-mail (rota pública).
 */
import { api } from './api';

/**
 * Senha atual errada volta como 400 "Senha atual incorreta." (não 401: o
 * cliente da API trataria 401 como sessão vencida e deslogaria a pessoa).
 */
export async function alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
  await api.put<void>('/auth/password', { senhaAtual, novaSenha });
}

/** Link inválido, usado ou vencido: 400 "Este link não vale mais. Peça um novo ao gestor." */
export async function redefinirSenha(token: string, novaSenha: string): Promise<void> {
  await api.post<void>('/auth/redefinir-senha', { token, novaSenha });
}
