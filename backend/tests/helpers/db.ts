import { carregarRelogio } from '../../src/lib/relogio';
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
  'configuracoes',
];

/**
 * Esvazia todas as tabelas do schema (respeitando dependências de chave
 * estrangeira) e reinicia as sequências. Usado entre testes de integração
 * para garantir isolamento sem depender da ordem de execução dos arquivos.
 * Inclui `configuracoes` (modo demonstração) e recarrega o relógio
 * (`carregarRelogio`), para o cache em memória de `lib/relogio.ts` não
 * continuar simulado depois de a linha sumir: todo teste começa no relógio
 * real e quem quer a data simulada a liga depois de truncar
 * (`helpers/data-de-demonstracao.ts`).
 */
export async function truncateAllTables(): Promise<void> {
  const tabelas = TABELAS_EM_ORDEM_DE_DEPENDENCIA.map((tabela) => `"${tabela}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE;`);
  await carregarRelogio();
}
