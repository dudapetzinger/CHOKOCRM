/**
 * Senha da própria conta (Etapa 8, spec 7.13): trocar estando logado. Senha
 * esquecida volta pela senha provisória que o gestor define em Usuários.
 */
import { api } from './api';

/**
 * Senha atual errada volta como 400 "Senha atual incorreta." (não 401: o
 * cliente da API trataria 401 como sessão vencida e deslogaria a pessoa).
 */
export async function alterarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
  await api.put<void>('/auth/password', { senhaAtual, novaSenha });
}
