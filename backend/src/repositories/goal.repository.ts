import type { Goal, PeriodoMeta, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { somarItens } from '../lib/somarItens';
import type { VisitaParaMeta } from '../services/goal.regras';

/** Meta como a tabela a grava: `inicio` e `fim` já como valor de coluna `@db.Date`. */
export type MetaData = {
  representanteId: string;
  periodo: PeriodoMeta;
  inicio: Date;
  fim: Date;
  metaVisitas: number;
  metaVendas: number;
  campanhaId: string | null;
};

const COM_REPRESENTANTE = { representante: { select: { id: true, nome: true } } } satisfies Prisma.GoalInclude;

export type MetaComRepresentante = Goal & { representante: { id: string; nome: string } };

/**
 * Metas com campanha `campanhaId` (`null` = só as sem campanha), com
 * `representanteId`, só as dele e, com `janela`, só as que cruzam a janela
 * (`inicio <= janela.fim && fim >= janela.inicio`; `Date` de coluna
 * `@db.Date`). Do período mais recente para o mais antigo; no mesmo início,
 * por nome do representante.
 */
export async function listar(filtro: {
  campanhaId: string | null;
  representanteId?: string;
  janela?: { inicio: Date; fim: Date };
}): Promise<MetaComRepresentante[]> {
  return prisma.goal.findMany({
    where: {
      campanhaId: filtro.campanhaId,
      ...(filtro.representanteId ? { representanteId: filtro.representanteId } : {}),
      ...(filtro.janela ? { inicio: { lte: filtro.janela.fim }, fim: { gte: filtro.janela.inicio } } : {}),
    },
    include: COM_REPRESENTANTE,
    orderBy: [{ inicio: 'desc' }, { fim: 'desc' }, { representante: { nome: 'asc' } }],
  });
}

export async function findById(id: string): Promise<Goal | null> {
  return prisma.goal.findUnique({ where: { id } });
}

export async function create(data: MetaData): Promise<MetaComRepresentante> {
  return prisma.goal.create({ data, include: COM_REPRESENTANTE });
}

export async function update(id: string, data: MetaData): Promise<MetaComRepresentante> {
  return prisma.goal.update({ where: { id }, data, include: COM_REPRESENTANTE });
}

export async function remove(id: string): Promise<void> {
  await prisma.goal.delete({ where: { id } });
}

/**
 * Visitas dos autores `autores` entre dois instantes (inclusive), com o
 * total do pedido somado em `Decimal`, para o realizado das metas.
 */
export async function listarVisitasParaMetas(filtro: {
  autores: string[];
  de: Date;
  ate: Date;
}): Promise<VisitaParaMeta[]> {
  const visitas = await prisma.visit.findMany({
    where: { userId: { in: filtro.autores }, dataHora: { gte: filtro.de, lte: filtro.ate } },
    select: {
      dataHora: true,
      userId: true,
      clientId: true,
      client: { select: { nomeFantasia: true } },
      resultado: true,
      campanhaId: true,
      itens: { select: { quantidade: true, precoUnitario: true } },
    },
  });

  return visitas.map(({ itens, client, ...visita }) => ({
    ...visita,
    clienteNome: client.nomeFantasia,
    totalPedido: somarItens(itens),
  }));
}
