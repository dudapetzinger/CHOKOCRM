import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { findByEmail } from '../repositories/user.repository';

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos';

/**
 * Hash bcrypt de uma senha que nunca corresponde a nenhuma conta real.
 * Quando o e-mail informado não existe, comparamos a senha recebida contra
 * este hash (em vez de encerrar cedo) para que o tempo de resposta não
 * revele se o e-mail está cadastrado (mitigação de timing attack).
 */
const HASH_DUMMY = '$2b$10$31T9jxWOlrUWt5hDRFaJAOHkYb2KYeI4XL//ymLpJ/UDuhsYxHSY2';

export type UsuarioAutenticado = {
  id: string;
  nome: string;
  email: string;
  role: Role;
};

export type LoginResultado = {
  token: string;
  user: UsuarioAutenticado;
};

export async function login(email: string, senha: string): Promise<LoginResultado> {
  const usuario = await findByEmail(email);
  const senhaConfere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_DUMMY);

  if (!usuario || !senhaConfere) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_CREDENCIAIS_INVALIDAS, 401);
  }

  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  const token = jwt.sign({ sub: usuario.id, role: usuario.role }, env.JWT_SECRET, options);

  return {
    token,
    user: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
    },
  };
}
