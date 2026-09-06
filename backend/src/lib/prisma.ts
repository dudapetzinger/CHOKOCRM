import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/**
 * Instância única de PrismaClient, compartilhada por toda a aplicação
 * (controllers/repositories) e pelos testes de integração.
 */
export const prisma = new PrismaClient({ adapter });
