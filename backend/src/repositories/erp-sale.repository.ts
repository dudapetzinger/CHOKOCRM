/**
 * Notas fiscais importadas (`ErpSale`), seus itens, o catálogo aprendido e as
 * importações. `salvarNota` grava ou atualiza a nota pela chave de acesso,
 * incluindo o endereço do destinatário lido da DANFE; as notas `SEM_CLIENTE`
 * são agrupadas por CNPJ e ligadas ao cliente criado pela nota fiscal. A
 * leitura por CNPJ alimenta os provedores `importado` e `hibrido`; neste,
 * `existeNotaDoCnpj` decide se o cliente usa as notas ou o ERP simulado.
 */
import type { Prisma, PrismaClient, VinculoNota } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { agora } from '../lib/relogio';

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
  /** Endereço do destinatário (DANFE); reimportar a nota atualiza estes campos. */
  destinatarioEndereco: string | null;
  destinatarioBairro: string | null;
  destinatarioCep: string | null;
  destinatarioMunicipio: string | null;
  destinatarioUf: string | null;
  destinatarioTelefone: string | null;
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

/** Grava a nota pela chave de acesso: nova, ou atualizada (dados, endereço do destinatário e itens recriados). */
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
      // "Importada em" é data de negócio: segue o relógio do sistema (data de demonstração).
      criadoEm: agora(),
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

/**
 * Da nota mais recente para a mais antiga. No mesmo dia, desempata pela chave
 * de acesso (44 dígitos de tamanho fixo, com o número da nota zerado à
 * esquerda): entre notas do mesmo emitente e série, a de número maior vem
 * antes — `numero` é texto e poria '999' acima de '1000'. `ErpSale` não tem
 * `criadoEm`, e `atualizadoEm` muda a cada vínculo.
 */
const ORDEM_MAIS_RECENTE = [
  { dataEmissao: 'desc' },
  { chaveAcesso: 'desc' },
] satisfies Prisma.ErpSaleOrderByWithRelationInput[];

export async function listarPendentes(): Promise<NotaComRelacoes[]> {
  return prisma.erpSale.findMany({
    where: { vinculoStatus: 'PENDENTE' },
    orderBy: ORDEM_MAIS_RECENTE,
    include: INCLUDE_NOTA,
  });
}

// --- Leitura das notas pelos provedores `importado` e `hibrido` ------------
// Sempre pelo CNPJ do destinatário, nunca por `clientId`: uma nota importada
// antes de o cliente existir passa a contar assim que ele é cadastrado.

const SELECT_VENDA = {
  numero: true,
  dataEmissao: true,
  valorTotal: true,
  itens: {
    orderBy: { ordem: 'asc' },
    select: { produtoCodigo: true, produtoNome: true, quantidade: true },
  },
} satisfies Prisma.ErpSaleSelect;

export type NotaParaVenda = Prisma.ErpSaleGetPayload<{ select: typeof SELECT_VENDA }>;

/** Filtro de `dataEmissao` (coluna `@db.Date`) com os dois dias inclusivos; sem dia, sem limite. */
function filtroDeEmissao(de?: Date, ate?: Date): Prisma.ErpSaleWhereInput['dataEmissao'] {
  return { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) };
}

/**
 * Notas do CNPJ emitidas entre os dias `de` e `ate` (colunas `@db.Date`,
 * inclusivos), da mais recente para a mais antiga; `limite` corta a lista.
 */
export async function listarNotasDoCnpj(
  cnpj: string,
  { de, ate, limite }: { de?: Date; ate?: Date; limite?: number } = {},
): Promise<NotaParaVenda[]> {
  return prisma.erpSale.findMany({
    where: { destinatarioCnpj: cnpj, dataEmissao: filtroDeEmissao(de, ate) },
    orderBy: ORDEM_MAIS_RECENTE,
    take: limite,
    select: SELECT_VENDA,
  });
}

/**
 * Há nota importada para o CNPJ? Decide a fonte do cliente no provedor
 * `hibrido` (notas ou simulado): uma consulta de existência pelo índice
 * `[destinatarioCnpj, dataEmissao]`, a cada chamada ao provedor.
 */
export async function existeNotaDoCnpj(cnpj: string, banco: Banco = prisma): Promise<boolean> {
  const quantidade = await banco.erpSale.count({ where: { destinatarioCnpj: cnpj } });
  return quantidade > 0;
}

/** Soma do valor total e quantidade de notas do CNPJ entre os dias `de` e `ate` (inclusivos). */
export async function somarNotasDoCnpj(
  cnpj: string,
  de: Date,
  ate: Date,
): Promise<{ total: Prisma.Decimal | null; quantidade: number }> {
  const resultado = await prisma.erpSale.aggregate({
    where: { destinatarioCnpj: cnpj, dataEmissao: filtroDeEmissao(de, ate) },
    _sum: { valorTotal: true },
    _count: { _all: true },
  });
  return { total: resultado._sum.valorTotal, quantidade: resultado._count._all };
}

/** Data de emissão da nota mais recente (de qualquer cliente); `null` sem notas. */
export async function ultimaDataDeEmissao(): Promise<Date | null> {
  const nota = await prisma.erpSale.findFirst({ orderBy: { dataEmissao: 'desc' }, select: { dataEmissao: true } });
  return nota?.dataEmissao ?? null;
}

/** Instante da importação mais recente; `null` se nunca houve. */
export async function ultimaImportacaoEm(): Promise<Date | null> {
  const importacao = await prisma.erpImport.findFirst({ orderBy: { criadoEm: 'desc' }, select: { criadoEm: true } });
  return importacao?.criadoEm ?? null;
}

/** Catálogo aprendido das notas (`ErpProduct`), por nome. */
export async function listarProdutos(): Promise<{ codigo: string; nome: string; precoUnitario: Prisma.Decimal }[]> {
  return prisma.erpProduct.findMany({
    orderBy: [{ nome: 'asc' }, { codigo: 'asc' }],
    select: { codigo: true, nome: true, precoUnitario: true },
  });
}

/** Um produto do catálogo aprendido pelo código; `null` se não existe. */
export async function findProdutoPorCodigo(
  codigo: string,
): Promise<{ codigo: string; nome: string; precoUnitario: Prisma.Decimal } | null> {
  return prisma.erpProduct.findUnique({
    where: { codigo },
    select: { codigo: true, nome: true, precoUnitario: true },
  });
}

// --- Cliente pela nota fiscal ------------------------------------------------

const SELECT_SEM_CLIENTE = {
  destinatarioCnpj: true,
  destinatarioNome: true,
  destinatarioEndereco: true,
  destinatarioBairro: true,
  destinatarioCep: true,
  destinatarioMunicipio: true,
  destinatarioUf: true,
  destinatarioTelefone: true,
  dataEmissao: true,
} satisfies Prisma.ErpSaleSelect;

export type DestinatarioDaNota = Prisma.ErpSaleGetPayload<{ select: typeof SELECT_SEM_CLIENTE }>;

export type GrupoSemCliente = {
  /** A nota mais recente do CNPJ: dela saem a razão social e o endereço. */
  maisRecente: DestinatarioDaNota;
  notas: number;
};

/**
 * Notas `SEM_CLIENTE` agrupadas pelo CNPJ do destinatário, do grupo de nota
 * mais recente para o mais antigo. Uma consulta só, já na ordem de
 * `ORDEM_MAIS_RECENTE`: a primeira nota vista de cada CNPJ é a mais recente.
 * CNPJ que já tem cliente fica de fora (defensivo: o cadastro do cliente já
 * adota as notas do CNPJ), para o gestor não tentar criá-lo e levar 409.
 */
export async function listarSemClientePorCnpj(): Promise<GrupoSemCliente[]> {
  const notas = await prisma.erpSale.findMany({
    where: { vinculoStatus: 'SEM_CLIENTE' },
    orderBy: ORDEM_MAIS_RECENTE,
    select: SELECT_SEM_CLIENTE,
  });
  const cnpjs = [...new Set(notas.map((n) => n.destinatarioCnpj))];
  const comCliente = new Set(
    (await prisma.client.findMany({ where: { cnpj: { in: cnpjs } }, select: { cnpj: true } })).map((c) => c.cnpj),
  );
  const grupos = new Map<string, GrupoSemCliente>();
  for (const nota of notas) {
    if (comCliente.has(nota.destinatarioCnpj)) continue;
    const grupo = grupos.get(nota.destinatarioCnpj);
    if (grupo) grupo.notas += 1;
    else grupos.set(nota.destinatarioCnpj, { maisRecente: nota, notas: 1 });
  }
  return [...grupos.values()];
}

/** Notas `SEM_CLIENTE` de um CNPJ, da mais antiga para a mais recente. */
export async function listarSemClienteDoCnpj(cnpj: string, banco: Banco = prisma): Promise<NotaComRelacoes[]> {
  return banco.erpSale.findMany({
    where: { destinatarioCnpj: cnpj, vinculoStatus: 'SEM_CLIENTE' },
    orderBy: [{ dataEmissao: 'asc' }, { chaveAcesso: 'asc' }],
    include: INCLUDE_NOTA,
  });
}

/**
 * Liga ao cliente as notas indicadas que ainda estão sem cliente (o status do
 * vínculo é decidido em seguida, nota a nota).
 */
export async function ligarCliente(ids: string[], clientId: string, banco: Banco = prisma): Promise<number> {
  const { count } = await banco.erpSale.updateMany({
    where: { id: { in: ids }, clientId: null, vinculoStatus: 'SEM_CLIENTE' },
    data: { clientId },
  });
  return count;
}
