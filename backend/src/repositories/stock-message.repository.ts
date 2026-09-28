import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const INCLUDE_RELACOES = {
  user: { select: { id: true, nome: true } },
  eventoSazonal: { select: { id: true, nome: true } },
  client: { select: { id: true, nomeFantasia: true } },
} as const;

export type StockMessageComRelacoes = Prisma.StockMessageGetPayload<{ include: typeof INCLUDE_RELACOES }>;

export type CreateStockMessageData = {
  clientId: string;
  userId: string;
  eventoSazonalId: string | null;
  textoFinal: string;
  dataGeracao: Date;
};

export async function create(data: CreateStockMessageData): Promise<StockMessageComRelacoes> {
  return prisma.stockMessage.create({ data, include: INCLUDE_RELACOES });
}

/** Histórico de mensagens geradas (UC12): mais recente primeiro, opcionalmente filtrado por cliente. */
export async function list(filtro: { clientId?: string }): Promise<StockMessageComRelacoes[]> {
  return prisma.stockMessage.findMany({
    where: filtro.clientId ? { clientId: filtro.clientId } : undefined,
    include: INCLUDE_RELACOES,
    orderBy: { dataGeracao: 'desc' },
  });
}
