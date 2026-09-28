import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

// `options: '-c timezone=UTC'` fixa o timezone da sessão Postgres (parâmetro de
// startup do libpq), independente do timezone padrão do servidor/host. As
// comparações de limite inclusivo em `seasonal-event.repository.ts`
// (`findVigentes`, `@db.Date`) partem de a coluna `date`, ao ser convertida
// para `timestamptz` para comparar com o instante da consulta, virar meia-
// -noite *na timezone da sessão*; sem isso fixado, um Postgres gerenciado
// com timezone padrão diferente de UTC (ex.: America/Sao_Paulo) excluiria
// silenciosamente o dia de início do evento.
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, options: '-c timezone=UTC' });

/**
 * Instância única de PrismaClient, compartilhada por toda a aplicação
 * (controllers/repositories) e pelos testes de integração.
 */
export const prisma = new PrismaClient({ adapter });
