import { Prisma, type PrismaClient, type ResultadoVisita } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { somarItens, type ItemSomavel } from '../lib/somarItens';
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

/**
 * Visitas com foto no disco feitas antes de `limite` (a limpeza dos 90
 * dias): só o que o job precisa, a visita e a chave do arquivo.
 */
export async function listComFotoAntesDe(limite: Date): Promise<{ id: string; fotoPath: string }[]> {
  const visitas = await prisma.visit.findMany({
    where: { fotoPath: { not: null }, dataHora: { lt: limite } },
    select: { id: true, fotoPath: true },
    orderBy: { dataHora: 'asc' },
  });

  return visitas.flatMap(({ id, fotoPath }) => (fotoPath === null ? [] : [{ id, fotoPath }]));
}

/** Depois de o arquivo sair do disco: zera o caminho e guarda quando foi (impede anexar outra foto). */
export async function marcarFotoApagada(id: string, quando: Date): Promise<void> {
  await prisma.visit.update({ where: { id }, data: { fotoPath: null, fotoApagadaEm: quando } });
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

/** Cliente do Prisma ou a transação em andamento (a importação de notas grava tudo numa transação só). */
type Banco = PrismaClient | Prisma.TransactionClient;

export type UltimaVisitaDoCliente = {
  id: string;
  dataHora: Date;
  resultado: ResultadoVisita;
  erpSaleId: string | null;
};

/** Visita mais recente do cliente, de qualquer resultado, para o vínculo com a nota (Etapa 12). */
export async function ultimaVisitaDoCliente(
  clientId: string,
  banco: Banco = prisma,
): Promise<UltimaVisitaDoCliente | null> {
  return banco.visit.findFirst({
    where: { clientId },
    orderBy: [{ dataHora: 'desc' }, { criadoEm: 'desc' }],
    select: { id: true, dataHora: true, resultado: true, erpSaleId: true },
  });
}

/** Visitas com os itens do pedido, para mostrar a visita sugerida das pendências. */
export async function findManyComItens(
  ids: string[],
  banco: Banco = prisma,
): Promise<{ id: string; dataHora: Date; resultado: ResultadoVisita; itens: ItemSomavel[] }[]> {
  return banco.visit.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      dataHora: true,
      resultado: true,
      itens: { select: { quantidade: true, precoUnitario: true } },
    },
  });
}

/**
 * Vincula a nota à visita: os itens do pedido são substituídos pelos da nota e
 * o resultado passa a VENDA (spec 2.4 da Etapa 12). Serve também para
 * atualizar os itens quando a mesma nota é importada de novo.
 */
export async function substituirItensPorNota(
  visitId: string,
  erpSaleId: string,
  itens: ItemDoPedidoData[],
  banco: Banco = prisma,
): Promise<void> {
  await banco.visitItem.deleteMany({ where: { visitId } });
  if (itens.length > 0) {
    await banco.visitItem.createMany({ data: itens.map((item) => ({ ...item, visitId })) });
  }
  await banco.visit.update({ where: { id: visitId }, data: { erpSaleId, resultado: 'VENDA' } });
}

/** Desfaz o vínculo: a visita perde a nota e fica sem itens (o que foi digitado no check-in não é guardado). */
export async function desvincularNota(visitId: string, banco: Banco = prisma): Promise<void> {
  await banco.visitItem.deleteMany({ where: { visitId } });
  await banco.visit.update({ where: { id: visitId }, data: { erpSaleId: null } });
}

/** Cliente e nota vinculada da visita, para validar o vínculo manual. */
export async function findParaVinculo(
  id: string,
  banco: Banco = prisma,
): Promise<{ id: string; clientId: string; erpSaleId: string | null } | null> {
  return banco.visit.findUnique({ where: { id }, select: { id: true, clientId: true, erpSaleId: true } });
}
