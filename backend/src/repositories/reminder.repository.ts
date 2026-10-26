import type { Prisma, PrismaClient, Reminder } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * Lembretes do cliente (tabela `lembretes`, Etapa 9): tarefa própria, com
 * data, aberta até ser concluída (`concluidoEm`). `data` é coluna `@db.Date`
 * (meia-noite UTC); quem a mostra converte com `dataDaColunaDate`.
 */

/** Lembrete novo; `data` já como valor de coluna `@db.Date`. */
export type LembreteData = {
  clientId: string;
  criadoPorId: string;
  visitId?: string;
  texto: string;
  data: Date;
};

/** Lembrete aberto com o cliente e o dono da carteira, para a ficha e a agenda. */
export type LembreteComCliente = {
  id: string;
  texto: string;
  data: Date;
  client: { id: string; nomeFantasia: string; cidade: string; representante: { id: string; nome: string } };
};

const SELECT_COM_CLIENTE = {
  id: true,
  texto: true,
  data: true,
  client: {
    select: { id: true, nomeFantasia: true, cidade: true, representante: { select: { id: true, nome: true } } },
  },
} satisfies Prisma.ReminderSelect;

/** Aceita a transação do check-in (`tx`), para o lembrete nascer junto com a visita. */
export async function create(
  data: LembreteData,
  banco: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<Reminder> {
  return banco.reminder.create({ data });
}

/** Lembrete com a carteira do cliente, para a regra de carteira ao concluir. */
export async function findById(id: string): Promise<(Reminder & { client: { representanteId: string } }) | null> {
  return prisma.reminder.findUnique({ where: { id }, include: { client: { select: { representanteId: true } } } });
}

/**
 * Lembretes abertos (`concluidoEm` nulo): com `clientId`, só os do cliente;
 * com `representanteId`, só os da carteira dele (o dono atual do cliente, não
 * quem criou); com `ate` (coluna `@db.Date`), só os com `data` até esse dia.
 * Por data, depois pelo nome do cliente e, no empate, pelo mais antigo.
 */
export async function listarAbertos(filtro: {
  clientId?: string;
  representanteId?: string;
  ate?: Date;
}): Promise<LembreteComCliente[]> {
  return prisma.reminder.findMany({
    where: {
      concluidoEm: null,
      ...(filtro.clientId ? { clientId: filtro.clientId } : {}),
      ...(filtro.representanteId ? { client: { representanteId: filtro.representanteId } } : {}),
      ...(filtro.ate ? { data: { lte: filtro.ate } } : {}),
    },
    select: SELECT_COM_CLIENTE,
    orderBy: [{ data: 'asc' }, { client: { nomeFantasia: 'asc' } }, { criadoEm: 'asc' }],
  });
}

export async function concluir(id: string, agora: Date): Promise<void> {
  await prisma.reminder.update({ where: { id }, data: { concluidoEm: agora } });
}
