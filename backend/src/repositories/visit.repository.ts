import { Prisma, type ResultadoVisita } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { somarItens } from '../lib/somarItens';
import * as reminderRepository from './reminder.repository';

/**
 * Itens do pedido em ordem alfabética do produto: a tabela não guarda a
 * ordem das linhas do formulário, e o id (uuid) não serve de ordem. O
 * serviço junta as linhas do mesmo SKU, então o nome não se repete.
 */
const INCLUDE_RELACOES = {
  contact: { select: { id: true, nome: true } },
  user: { select: { id: true, nome: true } },
  campanha: { select: { id: true, nome: true } },
  itens: {
    select: { sku: true, produtoNome: true, quantidade: true, precoUnitario: true },
    orderBy: { produtoNome: 'asc' },
  },
} as const;

export type VisitComRelacoes = Prisma.VisitGetPayload<{ include: typeof INCLUDE_RELACOES }>;

/** Linha do pedido já com nome e preço do catálogo (o serviço resolve). */
export type ItemDoPedidoData = {
  sku: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
};

/**
 * Campos do cliente que todo check-in regrava junto com a visita (spec 7.4
 * e 7.7): `proximaVisita` já como valor de coluna `@db.Date`; `null` apaga.
 */
export type ProximaVisitaDoClienteData = {
  proximaVisita: Date | null;
  proximaCampanhaId: string | null;
};

export type CreateVisitData = {
  clientId: string;
  userId: string;
  contactId?: string;
  campanhaId: string | null;
  dataHora: Date;
  descricao: string;
  resultado: ResultadoVisita;
  itens: ItemDoPedidoData[];
  proximaVisitaDoCliente: ProximaVisitaDoClienteData;
  /** Lembrete novo do check-in, com `data` já como valor de coluna `@db.Date`. */
  lembrete?: { texto: string; data: Date };
};

/**
 * Visita, itens do pedido (`create` aninhado), a próxima visita do cliente e
 * o lembrete novo (criado pelo autor, ligado à visita) numa transação só: ou
 * o check-in fica inteiro, ou nada muda. Os lembretes já abertos do cliente
 * não são tocados.
 */
export async function create({
  itens,
  proximaVisitaDoCliente,
  lembrete,
  ...data
}: CreateVisitData): Promise<VisitComRelacoes> {
  return prisma.$transaction(async (tx) => {
    const visita = await tx.visit.create({
      data: { ...data, ...(itens.length > 0 ? { itens: { create: itens } } : {}) },
      include: INCLUDE_RELACOES,
    });

    await tx.client.update({ where: { id: data.clientId }, data: proximaVisitaDoCliente });

    if (lembrete) {
      await reminderRepository.create(
        { ...lembrete, clientId: data.clientId, criadoPorId: data.userId, visitId: visita.id },
        tx,
      );
    }

    return visita;
  });
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

/** Visita do período para os indicadores do painel; `representanteId` é o dono da carteira do cliente. */
export type VisitaDoPeriodoData = {
  clientId: string;
  clienteNome: string;
  resultado: ResultadoVisita;
  dataHora: Date;
  representanteId: string;
};

/** Visita do período com o total do pedido, para o comparativo e o relatório. */
export type VisitaDoPeriodoComPedidoData = VisitaDoPeriodoData & { totalPedido: Prisma.Decimal };

/** `dataHora` entre `inicio` e `fim`, inclusive; com `representanteId`, só a carteira dele. */
function filtroDoPeriodo(inicio: Date, fim: Date, representanteId?: string): Prisma.VisitWhereInput {
  return { dataHora: { gte: inicio, lte: fim }, ...(representanteId ? { client: { representanteId } } : {}) };
}

const SELECT_DO_PERIODO = {
  clientId: true,
  resultado: true,
  dataHora: true,
  client: { select: { nomeFantasia: true, representanteId: true } },
} satisfies Prisma.VisitSelect;

/**
 * Visitas do período para os indicadores do painel (UC14): só o que as regras
 * usam, sem os itens do pedido (`obterKpis` não soma vendas). `dataHora`
 * entre `inicio` e `fim`, inclusive. Com `representanteId`, só visitas a
 * clientes da carteira dele (a carteira do cliente, não o autor da visita).
 * `representanteId` de cada item é o dono da carteira do cliente e
 * `clienteNome` o nome fantasia dele.
 */
export async function listNoPeriodo(
  inicio: Date,
  fim: Date,
  representanteId?: string,
): Promise<VisitaDoPeriodoData[]> {
  const visitas = await prisma.visit.findMany({
    where: filtroDoPeriodo(inicio, fim, representanteId),
    select: SELECT_DO_PERIODO,
  });

  return visitas.map(({ client, ...visita }) => ({
    ...visita,
    clienteNome: client.nomeFantasia,
    representanteId: client.representanteId,
  }));
}

/**
 * O mesmo de `listNoPeriodo`, com `totalPedido` (a soma `quantidade ×
 * precoUnitario` dos itens, zero sem itens, como em `listarVisitasParaMetas`),
 * para o comparativo por representante e o relatório da planilha (spec 7.12).
 */
export async function listNoPeriodoComPedido(
  inicio: Date,
  fim: Date,
  representanteId?: string,
): Promise<VisitaDoPeriodoComPedidoData[]> {
  const visitas = await prisma.visit.findMany({
    where: filtroDoPeriodo(inicio, fim, representanteId),
    select: { ...SELECT_DO_PERIODO, itens: { select: { quantidade: true, precoUnitario: true } } },
  });

  return visitas.map(({ client, itens, ...visita }) => ({
    ...visita,
    clienteNome: client.nomeFantasia,
    representanteId: client.representanteId,
    totalPedido: somarItens(itens),
  }));
}
