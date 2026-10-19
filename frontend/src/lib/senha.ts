/**
 * Regras da senha nova no front (criar usuário, alterar e redefinir senha),
 * espelhando o backend (`senhaSchema`, mínimo de 6). A senha não é aparada:
 * vale exatamente o que foi digitado, como no backend.
 */
export const TAMANHO_MINIMO_SENHA = 6;
export const MENSAGEM_SENHA_CURTA = 'A senha deve ter pelo menos 6 caracteres.';
export const MENSAGEM_SENHAS_DIFERENTES = 'As senhas não conferem.';

export type ErrosNovaSenha = { senha?: string; confirmacao?: string };

export function validarNovaSenha(senha: string, confirmacao: string): ErrosNovaSenha {
  const erros: ErrosNovaSenha = {};
  if (senha.length < TAMANHO_MINIMO_SENHA) erros.senha = MENSAGEM_SENHA_CURTA;
  if (confirmacao !== senha) erros.confirmacao = MENSAGEM_SENHAS_DIFERENTES;
  return erros;
}
