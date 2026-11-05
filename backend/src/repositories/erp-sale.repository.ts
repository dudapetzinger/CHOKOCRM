import type { Prisma, PrismaClient, VinculoNota } from '@prisma/client';
import { prisma } from '../lib/prisma';

/** Cliente do Prisma ou a transação em andamento: a importação grava tudo numa transação só. */
export type Banco = PrismaClient | Prisma.TransactionClient;

export const INCLUDE_NOTA = {
  itens: { orderBy: { ordem: 'asc' } },
  client: { select: { id: true, nomeFantasia: true } },
  visita: { select: { id: true } },
} satisfies Prisma.ErpSaleInclude;

export type NotaComRelacoes = Prisma.ErpSaleGetPayload<{ include: typeof INCLUDE_NOTA }>;

const INCLUDE_IMPORTACAO = {
  user: { select: { id: true, nome: true } },
  sales: { include: INCLUDE_NOTA, orderBy: [{ numero: 'asc' }] },
} satisfies Prisma.ErpImportInclude;

export type ImportacaoComRelacoes = Prisma.ErpImportGetPayload<{ include: typeof INCLUDE_IMPORTACAO }>;

export type ItemDaNotaData = {
  produtoCodigo: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
};

export type NotaData = {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: Date;
  naturezaOperacao: string;
  destinatarioCnpj: string;
  destinatarioNome: string;
  clientId: string | null;
  valorProdutos: number;
  desconto: number;
  valorTotal: number;
  importId: string;
  vinculoStatus: VinculoNota;
  visitaSugeridaId: string | null;
  itens: ItemDaNotaData[];
};

/** Cliente pelo CNPJ (o cadastro guarda só os 14 dígitos, ver `cnpjSchema`); a nota traz só dígitos. */
export async function findClienteIdPorCnpj(cnpj: string, banco: Banco = prisma): Promise<string | null> {
  const cliente = await banco.client.findUnique({ where: { cnpj: cnpj.replace(/\D/g, '') }, select: { id: true } });
  return cliente?.id ?? null;
}

export async function findByChave(chaveAcesso: string, banco: Banco = prisma): Promise<NotaComRelacoes | null> {
  return banco.erpSale.findUnique({ where: { chaveAcesso }, include: INCLUDE_NOTA });
}

export async function findById(id: string, banco: Banco = prisma): Promise<NotaComRelacoes | null> {
  return banco.erpSale.findUnique({ where: { id }, include: INCLUDE_NOTA });
}

/** Grava a nota pela chave de acesso: nova, ou atualizada com os itens recriados. */
export async function salvarNota(
  { itens, chaveAcesso, ...dados }: NotaData,
  existente: boolean,
  banco: Banco = prisma,
): Promise<NotaComRelacoes> {
  const itensComOrdem = itens.map((item, ordem) => ({ ...item, ordem }));
  if (!existente) {
    return banco.erpSale.create({
      data: { chaveAcesso, ...dados, itens: { create: itensComOrdem } },
      include: INCLUDE_NOTA,
    });
  }
  return banco.erpSale.update({
    where: { chaveAcesso },
    data: { ...dados, itens: { deleteMany: {}, create: itensComOrdem } },
    include: INCLUDE_NOTA,
  });
}

export async function atualizarVinculo(
  id: string,
  vinculoStatus: VinculoNota,
  visitaSugeridaId: string | null,
  banco: Banco = prisma,
): Promise<NotaComRelacoes> {
  return banco.erpSale.update({
    where: { id },
    data: { vinculoStatus, visitaSugeridaId },
    include: INCLUDE_NOTA,
  });
}

/** Catálogo aprendido das notas: o último nome e preço visto de cada código. */
export async function registrarProduto(
  codigo: string,
  nome: string,
  precoUnitario: number,
  banco: Banco = prisma,
): Promise<void> {
  await banco.erpProduct.upsert({
    where: { codigo },
    create: { codigo, nome, precoUnitario },
    update: { nome, precoUnitario },
  });
}

export async function criarImportacao(
  userId: string,
  nomeArquivo: string,
  banco: Banco = prisma,
): Promise<{ id: string }> {
  return banco.erpImport.create({
    data: {
      userId,
      nomeArquivo,
      notasImportadas: 0,
      notasIgnoradas: 0,
      vinculadasAutomaticamente: 0,
      pendentes: 0,
      cnpjsSemCliente: [],
    },
    select: { id: true },
  });
}

export type TotaisDaImportacao = {
  notasImportadas: number;
  notasIgnoradas: number;
  vinculadasAutomaticamente: number;
  pendentes: number;
  cnpjsSemCliente: { cnpj: string; razaoSocial: string }[];
};

export async function fecharImportacao(id: string, totais: TotaisDaImportacao, banco: Banco = prisma): Promise<void> {
  await banco.erpImport.update({ where: { id }, data: totais });
}

export async function findImportacaoById(id: string, banco: Banco = prisma): Promise<ImportacaoComRelacoes | null> {
  return banco.erpImport.findUnique({ where: { id }, include: INCLUDE_IMPORTACAO });
}

export async function listarImportacoes(limite: number): Promise<ImportacaoComRelacoes[]> {
  return prisma.erpImport.findMany({
    orderBy: { criadoEm: 'desc' },
    take: limite,
    include: INCLUDE_IMPORTACAO,
  });
}

export async function listarPendentes(): Promise<NotaComRelacoes[]> {
  return prisma.erpSale.findMany({
    where: { vinculoStatus: 'PENDENTE' },
    orderBy: [{ dataEmissao: 'desc' }, { numero: 'desc' }],
    include: INCLUDE_NOTA,
  });
}
