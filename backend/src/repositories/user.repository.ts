import type { Role, User } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function listByRole(role: Role): Promise<Pick<User, 'id' | 'nome'>[]> {
  return prisma.user.findMany({ where: { role }, select: { id: true, nome: true } });
}
