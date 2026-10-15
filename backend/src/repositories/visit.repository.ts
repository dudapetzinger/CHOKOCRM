import type { Prisma, ResultadoVisita } from '@prisma/client';
import { prisma } from '../lib/prisma';

const INCLUDE_RELACOES = {
  contact: { select: { id: true, nome: true } },
  user: { select: { id: true, nome: true } },
} as const;

export type VisitComRelacoes = Prisma.VisitGetPayload<{ include: typeof INCLUDE_RELACOES }>;

export type CreateVisitData = {
  clientId: string;
  userId: string;
  contactId?: string;
  dataHora: Date;
  descricao: string;
  resultado: ResultadoVisita;
};

export async function create(data: CreateVisitData): Promise<VisitComRelacoes> {
  return prisma.visit.create({ data, include: INCLUDE_RELACOES });
}

/** Timeline do cliente: mais recente primeiro (usa o índice da migration). */
export async function listByClient(clientId: string): Promise<VisitComRelacoes[]> {
  return prisma.visit.findMany({
    where: { clientId },
    orderBy: { dataHora: 'desc' },
    include: INCLUDE_RELACOES,
  });
}

export type VisitComCarteira = VisitComRelacoes & { client: { representanteId: string } };

/** Visita com a carteira do cliente, para a regra de carteira nas rotas por id. */
export async function findById(id: string): Promise<VisitComCarteira | null> {
  return prisma.visit.findUnique({
    where: { id },
    include: { ...INCLUDE_RELACOES, client: { select: { representanteId: true } } },
  });
}

export async function updateDescricao(id: string, descricao: string): Promise<VisitComRelacoes> {
  return prisma.visit.update({
    where: { id },
    data: { descricao, editadoEm: new Date() },
    include: INCLUDE_RELACOES,
  });
}

export async function setFotoPath(id: string, fotoPath: string): Promise<VisitComRelacoes> {
  return prisma.visit.update({ where: { id }, data: { fotoPath }, include: INCLUDE_RELACOES });
}

export async function contatoPertenceAoCliente(contactId: string, clientId: string): Promise<boolean> {
  const contato = await prisma.contact.findFirst({ where: { id: contactId, clientId }, select: { id: true } });
  return contato !== null;
}

/**
 * Visitas do período para os indicadores do painel (UC14): só o que as regras
 * usam; `dataHora` entre `inicio` e `fim`, inclusive. Com `representanteId`,
 * só visitas a clientes da carteira dele (a carteira do cliente, não o autor
 * da visita). `representanteId` de cada item é o dono da carteira do cliente,
 * para o comparativo por representante.
 */
export async function listNoPeriodo(
  inicio: Date,
  fim: Date,
  representanteId?: string,
): Promise<{ clientId: string; resultado: ResultadoVisita; dataHora: Date; representanteId: string }[]> {
  const visitas = await prisma.visit.findMany({
    where: { dataHora: { gte: inicio, lte: fim }, ...(representanteId ? { client: { representanteId } } : {}) },
    select: { clientId: true, resultado: true, dataHora: true, client: { select: { representanteId: true } } },
  });

  return visitas.map(({ client, ...visita }) => ({ ...visita, representanteId: client.representanteId }));
}
