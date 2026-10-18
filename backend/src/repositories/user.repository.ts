import type { PasswordResetToken, Prisma, Role, User } from '@prisma/client';
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

/**
 * Links de redefinição ainda abertos da pessoa (`where` de `updateMany`),
 * para marcá-los como usados. `alemDe` restringe o filtro (ex.: só os
 * anteriores a um link novo).
 */
function linksAbertos(
  userId: string,
  alemDe: Prisma.PasswordResetTokenWhereInput = {},
): Prisma.PasswordResetTokenWhereInput {
  return { ...alemDe, userId, usadoEm: null };
}

/**
 * Com `invalidarLinksDeRedefinicao`, marca como usados os links abertos da
 * pessoa na mesma transação da edição: inativar a conta ou trocar o e-mail
 * (o link foi para o endereço antigo) tira a validade deles.
 */
export async function update(
  id: string,
  data: Partial<Pick<User, 'nome' | 'email' | 'telefone' | 'role' | 'ativo'>>,
  opcoes: { invalidarLinksDeRedefinicao?: boolean } = {},
): Promise<User> {
  if (!opcoes.invalidarLinksDeRedefinicao) {
    return prisma.user.update({ where: { id }, data });
  }

  const [usuario] = await prisma.$transaction([
    prisma.user.update({ where: { id }, data }),
    prisma.passwordResetToken.updateMany({ where: linksAbertos(id), data: { usadoEm: new Date() } }),
  ]);
  return usuario;
}

/** Troca da própria senha: os links de redefinição abertos deixam de valer. */
export async function updateSenhaEInvalidarLinks(id: string, senhaHash: string): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { senhaHash } }),
    prisma.passwordResetToken.updateMany({ where: linksAbertos(id), data: { usadoEm: new Date() } }),
  ]);
}

/** Grava o hash de um link novo. Os anteriores só morrem depois do envio (ver user.service). */
export async function createTokenDeRedefinicao(data: {
  userId: string;
  tokenHash: string;
  expiraEm: Date;
}): Promise<Pick<PasswordResetToken, 'id' | 'criadoEm'>> {
  return prisma.passwordResetToken.create({ data, select: { id: true, criadoEm: true } });
}

/** Link novo cujo e-mail não saiu: ninguém o recebeu, então deixa de valer. */
export async function descartarTokenDeRedefinicao(id: string, agora: Date): Promise<void> {
  await prisma.passwordResetToken.updateMany({ where: { id, usadoEm: null }, data: { usadoEm: agora } });
}

/**
 * Depois que o e-mail do link novo saiu, os anteriores ainda abertos deixam
 * de valer: só o mais recente vale. "Anterior" = criado até o instante do
 * novo; um link criado depois (pedido simultâneo) não é tocado.
 */
export async function invalidarLinksAnteriores(params: {
  userId: string;
  novo: Pick<PasswordResetToken, 'id' | 'criadoEm'>;
  agora: Date;
}): Promise<void> {
  const { userId, novo, agora } = params;

  await prisma.passwordResetToken.updateMany({
    where: linksAbertos(userId, { id: { not: novo.id }, criadoEm: { lte: novo.criadoEm } }),
    data: { usadoEm: agora },
  });
}

export async function findTokenDeRedefinicao(
  tokenHash: string,
): Promise<(PasswordResetToken & { user: Pick<User, 'ativo'> }) | null> {
  return prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { ativo: true } } },
  });
}

/**
 * Usa o link e grava a senha nova na mesma transação. O `updateMany`
 * condicional (ainda não usado, não vencido e de conta ativa) é o que
 * garante o uso único mesmo com dois pedidos simultâneos — só um deles
 * marca o link — e pega uma inativação entre a consulta e a gravação.
 * Usado o link, os outros abertos da pessoa também morrem. Devolve
 * `false`, sem mudar nada, se o link já não valia.
 */
export async function consumirTokenERedefinirSenha(params: {
  tokenId: string;
  userId: string;
  senhaHash: string;
  agora: Date;
}): Promise<boolean> {
  const { tokenId, userId, senhaHash, agora } = params;

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: tokenId, usadoEm: null, expiraEm: { gte: agora }, user: { ativo: true } },
      data: { usadoEm: agora },
    });
    if (count !== 1) {
      return false;
    }

    await tx.user.update({ where: { id: userId }, data: { senhaHash } });
    await tx.passwordResetToken.updateMany({ where: linksAbertos(userId), data: { usadoEm: agora } });
    return true;
  });
}
