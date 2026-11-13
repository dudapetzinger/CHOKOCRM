import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { findById, findByUsuario, updateSenha } from '../repositories/user.repository';

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'Usuário ou senha inválidos';
const MENSAGEM_CONTA_INATIVA = 'Conta inativa. Fale com o gestor.';
const MENSAGEM_SESSAO_INVALIDA = 'Token de autenticação ausente ou inválido.';
const MENSAGEM_SENHA_ATUAL_INCORRETA = 'Senha atual incorreta.';

const CUSTO_BCRYPT = 10;

/**
 * Hash bcrypt de uma senha aleatória, gerado ao carregar o módulo, que nunca
 * corresponde a nenhuma conta real.
 * Quando o usuário informado não existe, comparamos a senha recebida contra
 * este hash (em vez de encerrar cedo) para que o tempo de resposta não
 * revele se o usuário está cadastrado (mitigação de timing attack).
 */
const HASH_DUMMY = bcrypt.hashSync(randomBytes(32).toString('hex'), CUSTO_BCRYPT);

/** O usuário como o app o vê (login e `GET /auth/me`), sem o hash da senha. */
export type UsuarioDaSessao = {
  id: string;
  nome: string;
  usuario: string;
  telefone: string | null;
  role: Role;
  ativo: boolean;
};

export type LoginResultado = {
  token: string;
  user: UsuarioDaSessao;
};

function toUsuarioDaSessao(usuario: User): UsuarioDaSessao {
  return {
    id: usuario.id,
    nome: usuario.nome,
    usuario: usuario.usuario,
    telefone: usuario.telefone,
    role: usuario.role,
    ativo: usuario.ativo,
  };
}

export async function hashDaSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

/**
 * Confere usuário e senha e devolve a conta, sem olhar papel nem situação
 * (quem chama decide): 401 genérico se o usuário não existe ou a senha não
 * confere. Usado pelo login e pelo modo demonstração
 * (`demonstracao.service.ts`), que não emite token.
 */
export async function conferirCredenciais(usuario: string, senha: string): Promise<User> {
  const conta = await findByUsuario(usuario.trim().toLowerCase());
  const senhaConfere = await bcrypt.compare(senha, conta?.senhaHash ?? HASH_DUMMY);

  if (!conta || !senhaConfere) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_CREDENCIAIS_INVALIDAS, 401);
  }
  return conta;
}

export async function login(nomeDeUsuario: string, senha: string): Promise<LoginResultado> {
  const usuario = await conferirCredenciais(nomeDeUsuario, senha);

  // Só depois de conferir a senha: quem não a sabe recebe o 401 genérico e
  // não descobre que a conta existe e está inativa.
  if (!usuario.ativo) {
    throw new AppError(ErrorCode.FORBIDDEN, MENSAGEM_CONTA_INATIVA, 403);
  }

  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: usuario.id, role: usuario.role }, env.JWT_SECRET, options);

  return { token, user: toUsuarioDaSessao(usuario) };
}

/**
 * Usuário do token lido do banco (nome, telefone e situação atuais). A
 * inativação não derruba a sessão vigente: vale a partir do próximo login.
 */
export async function obterUsuarioDaSessao(id: string): Promise<UsuarioDaSessao> {
  const usuario = await findById(id);
  if (!usuario) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_SESSAO_INVALIDA, 401);
  }

  return toUsuarioDaSessao(usuario);
}

/** Troca da própria senha, conferindo a atual. */
export async function alterarSenha(id: string, senhaAtual: string, novaSenha: string): Promise<void> {
  const usuario = await findById(id);
  if (!usuario) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_SESSAO_INVALIDA, 401);
  }

  // 400, não 401: o front trata todo 401 com token como sessão vencida e
  // desloga a pessoa; senha atual errada é erro do formulário.
  if (!(await bcrypt.compare(senhaAtual, usuario.senhaHash))) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_SENHA_ATUAL_INCORRETA, 400);
  }

  await updateSenha(id, await hashDaSenha(novaSenha));
}
