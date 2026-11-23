import type { Campaign, Goal, TipoCampanha } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { VisitaVinculada } from '../services/campaign.regras';
import { colunaDateDaData, type DataCalendario } from '../services/classificacao.service';

/** Campanha como a tabela a grava: `inicio` e `fim` já como valor de coluna `@db.Date`. */
export type CampanhaData = {
  nome: string;
  tipo: TipoCampanha;
  inicio: Date;
  fim: Date;
  descricao: string;
  desconto: number | null;
  produtos: string[];
};

/** Todas, em ordem de início (e de nome, no mesmo dia). */
export async function listar(): Promise<Campaign[]> {
  return prisma.campaign.findMany({ orderBy: [{ inicio: 'asc' }, { nome: 'asc' }] });
}

/**
 * As que têm algum dia em `[de, ate]` (inclusivos): `inicio <= ate` e
 * `fim >= de`, comparando as colunas `@db.Date` com meia-noite UTC. Base do
 * calendário da Agenda.
 */
export async function listarNoIntervalo(de: DataCalendario, ate: DataCalendario): Promise<Campaign[]> {
  return prisma.campaign.findMany({
    where: { inicio: { lte: colunaDateDaData(ate) }, fim: { gte: colunaDateDaData(de) } },
    orderBy: [{ inicio: 'asc' }, { nome: 'asc' }],
  });
}

export async function findById(id: string): Promise<Campaign | null> {
  return prisma.campaign.findUnique({ where: { id } });
}

export async function create(data: CampanhaData): Promise<Campaign> {
  return prisma.campaign.create({ data });
}

/** Novo período de uma meta da campanha, já como valor de coluna `@db.Date`. */
export type PeriodoDaMetaAjustada = { id: string; inicio: Date; fim: Date };

/**
 * Grava a campanha e o novo período das metas dela numa transação só: ou
 * tudo muda, ou nada muda. Sem isso, uma falha no meio deixaria uma meta
 * com datas fora da campanha. As metas são lidas dentro da transação e
 * `ajustar` (a regra, que vem do serviço) diz quais mudam de data e para
 * quais datas. `data` pode trazer só o que mudou (ao encerrar, só o `fim`).
 */
export async function updateComMetas(
  id: string,
  data: Partial<CampanhaData>,
  ajustar: (metas: Goal[]) => PeriodoDaMetaAjustada[],
): Promise<Campaign> {
  return prisma.$transaction(async (transacao) => {
    const campanha = await transacao.campaign.update({ where: { id }, data });
    const metas = await transacao.goal.findMany({ where: { campanhaId: id } });

    for (const meta of ajustar(metas)) {
      await transacao.goal.update({ where: { id: meta.id }, data: { inicio: meta.inicio, fim: meta.fim } });
    }
    return campanha;
  });
}

/** As visitas e próximas visitas vinculadas ficam sem campanha (`onDelete: SetNull`). */
export async function remove(id: string): Promise<void> {
  await prisma.campaign.delete({ where: { id } });
}

/**
 * Visitas vinculadas às campanhas, com o autor, o cliente (nome e cidade) e
 * o pedido (SKU e nome gravados), para os resultados, os produtos mais
 * vendidos e a lista de vendas. Com `campanhaId`, só as daquela campanha;
 * com `autorId`, só as daquele autor (o representante vê só o que é dele).
 */
export async function listarVisitasVinculadas(
  filtro: { campanhaId?: string; autorId?: string } = {},
): Promise<(VisitaVinculada & { campanhaId: string })[]> {
  const visitas = await prisma.visit.findMany({
    where: {
      campanhaId: filtro.campanhaId ?? { not: null },
      ...(filtro.autorId ? { userId: filtro.autorId } : {}),
    },
    select: {
      id: true,
      dataHora: true,
      campanhaId: true,
      clientId: true,
      resultado: true,
      client: { select: { id: true, nomeFantasia: true, cidade: true } },
      user: { select: { id: true, nome: true } },
      itens: {
        select: { sku: true, produtoNome: true, quantidade: true, precoUnitario: true },
        // Mesma ordem da ficha do cliente: a lista de vendas mostra os itens sempre iguais.
        orderBy: { produtoNome: 'asc' },
      },
    },
  });

  // O `where` já deixa de fora as sem campanha; o filtro só estreita o tipo.
  return visitas.flatMap(({ campanhaId, user, client, ...visita }) =>
    campanhaId ? [{ ...visita, campanhaId, autor: user, cliente: client }] : [],
  );
}
