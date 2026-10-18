import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import {
  consumirTokenERedefinirSenha,
  findByEmail,
  findById,
  findTokenDeRedefinicao,
  updateSenhaEInvalidarLinks,
} from '../repositories/user.repository';
import { hashDoToken, tokenAindaVale } from './redefinicao-senha.regras';

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos';
const MENSAGEM_CONTA_INATIVA = 'Conta inativa. Fale com o gestor.';
const MENSAGEM_SESSAO_INVALIDA = 'Token de autenticação ausente ou inválido.';
const MENSAGEM_SENHA_ATUAL_INCORRETA = 'Senha atual incorreta.';
const MENSAGEM_LINK_INVALIDO = 'Este link não vale mais. Peça um novo ao gestor.';

const CUSTO_BCRYPT = 10;

/**
 * Hash bcrypt de uma senha que nunca corresponde a nenhuma conta real.
 * Quando o e-mail informado não existe, comparamos a senha recebida contra
 * este hash (em vez de encerrar cedo) para que o tempo de resposta não
 * revele se o e-mail está cadastrado (mitigação de timing attack).
 */
const HASH_DUMMY = '$2b$10$31T9jxWOlrUWt5hDRFaJAOHkYb2KYeI4XL//ymLpJ/UDuhsYxHSY2';

/** O usuário como o app o vê (login e `GET /auth/me`), sem o hash da senha. */
export type UsuarioDaSessao = {
  id: string;
  nome: string;
  email: string;
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
    email: usuario.email,
    telefone: usuario.telefone,
    role: usuario.role,
    ativo: usuario.ativo,
  };
}

export async function hashDaSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

export async function login(email: string, senha: string): Promise<LoginResultado> {
  const usuario = await findByEmail(email.toLowerCase());
  const senhaConfere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_DUMMY);

  if (!usuario || !senhaConfere) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_CREDENCIAIS_INVALIDAS, 401);
  }

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

/** Troca da própria senha, conferindo a atual. Links de redefinição abertos deixam de valer. */
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

  await updateSenhaEInvalidarLinks(id, await hashDaSenha(novaSenha));
}

/**
 * Redefinição pelo link do e-mail (rota pública). O token é procurado pelo
 * hash; inexistente, usado, vencido ou de conta inativa respondem a mesma
 * mensagem. Não desloga ninguém: o JWT vigente expira sozinho.
 */
export async function redefinirSenha(token: string, novaSenha: string): Promise<void> {
  const agora = new Date();
  const registro = await findTokenDeRedefinicao(hashDoToken(token));

  if (!registro || !registro.user.ativo || !tokenAindaVale(registro, agora)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_LINK_INVALIDO, 400);
  }

  const redefinida = await consumirTokenERedefinirSenha({
    tokenId: registro.id,
    userId: registro.userId,
    senhaHash: await hashDaSenha(novaSenha),
    agora,
  });

  // Outro pedido usou ou invalidou o link entre a consulta e a gravação.
  if (!redefinida) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_LINK_INVALIDO, 400);
  }
}
