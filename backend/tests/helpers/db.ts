import { prisma } from '../../src/lib/prisma';

const TABELAS_EM_ORDEM_DE_DEPENDENCIA = [
  'erp_sale_items',
  'erp_products',
  'stock_messages',
  'visit_schedule_changes',
  'lembretes',
  'visit_items',
  'visits',
  'erp_sales',
  'erp_imports',
  'contacts',
  'seasonal_events',
  'clients',
  'goals',
  'campaigns',
  'users',
];

/**
 * Esvazia todas as tabelas do schema (respeitando dependências de chave
 * estrangeira) e reinicia as sequências. Usado entre testes de integração
 * para garantir isolamento sem depender da ordem de execução dos arquivos.
 */
export async function truncateAllTables(): Promise<void> {
  const tabelas = TABELAS_EM_ORDEM_DE_DEPENDENCIA.map((tabela) => `"${tabela}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE;`);
}
