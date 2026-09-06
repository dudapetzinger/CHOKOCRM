import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}
