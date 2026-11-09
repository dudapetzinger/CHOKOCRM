import type { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../lib/prisma';

/** E-mail já em minúsculas: é assim que ele é gravado (ver `schemas/user.schema.ts`). */
export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * Usuários **ativos** de um papel (id e nome), por nome: o seletor de
 * representante do gestor e o job diário só enxergam quem está ativo. Com
 * `incluirInativos`, todos — o comparativo de indicadores por representante
 * continua mostrando o histórico de quem foi inativado.
 */
export async function listByRole(
  role: Role,
  opcoes: { incluirInativos?: boolean } = {},
): Promise<Pick<User, 'id' | 'nome'>[]> {
  return prisma.user.findMany({
    where: { role, ...(opcoes.incluirInativos ? {} : { ativo: true }) },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });
}

/** Usuário com a contagem dos clientes **ativos** da carteira dele. */
export type UsuarioComCarteira = User & { _count: { clients: number } };

const CONTAGEM_DA_CARTEIRA = {
  _count: { select: { clients: { where: { ativo: true } } } },
} satisfies Prisma.UserInclude;

export async function listComCarteira(): Promise<UsuarioComCarteira[]> {
  return prisma.user.findMany({ include: CONTAGEM_DA_CARTEIRA, orderBy: { nome: 'asc' } });
}

export async function findByIdComCarteira(id: string): Promise<UsuarioComCarteira | null> {
  return prisma.user.findUnique({ where: { id }, include: CONTAGEM_DA_CARTEIRA });
}

export async function create(data: {
  nome: string;
  email: string;
  telefone: string | null;
  role: Role;
  senhaHash: string;
}): Promise<User> {
  return prisma.user.create({ data });
}

/** Edição pelo gestor (a senha não muda por aqui). */
export async function update(
  id: string,
  data: Partial<Pick<User, 'nome' | 'email' | 'telefone' | 'role' | 'ativo'>>,
): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

/** Grava o hash da senha: troca da própria senha ou senha provisória pelo gestor. */
export async function updateSenha(id: string, senhaHash: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { senhaHash } });
}
