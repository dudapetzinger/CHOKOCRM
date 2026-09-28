import type { Client, Contact, Prisma, ResultadoVisita, VisitScheduleChange } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateClientInput, UpdateClientInput } from '../schemas/client.schema';

export type AtivoFiltro = 'ativos' | 'todos';

/**
 * Projeção da última visita (por `dataHora`), reaproveitada tanto na
 * listagem quanto na ficha para classificar a cor do cliente (ADR-005:
 * a cor nunca é persistida, sempre calculada a partir da última visita).
 */
export const SELECT_ULTIMA_VISITA = {
  take: 1,
  orderBy: { dataHora: 'desc' as const },
  select: { dataHora: true, resultado: true },
} as const;

export type ClientComContatoPrincipal = Client & {
  contacts: Pick<Contact, 'nome' | 'telefone'>[];
  visits: { dataHora: Date; resultado: ResultadoVisita }[];
  representante: { id: string; nome: string };
};

export type ClientComContatos = Client & {
  contacts: Contact[];
  visits: { dataHora: Date; resultado: ResultadoVisita }[];
  representante: { id: string; nome: string };
  scheduleChanges: (VisitScheduleChange & { user: { id: string; nome: string } })[];
};

export type ClienteParaAgenda = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  criadoEm: Date;
  recorrenciaDias: number;
  visits: { dataHora: Date; resultado: ResultadoVisita }[];
};

/**
 * Clientes ativos elegíveis para a agenda do dia (UC10): sem
 * `representanteId`, todos os representantes (visão do gestor); com
 * `representanteId`, só a carteira daquele representante.
 */
export async function listAtivosParaAgenda(representanteId?: string): Promise<ClienteParaAgenda[]> {
  return prisma.client.findMany({
    where: { ativo: true, ...(representanteId ? { representanteId } : {}) },
    select: {
      id: true,
      nomeFantasia: true,
      cidade: true,
      criadoEm: true,
      recorrenciaDias: true,
      visits: SELECT_ULTIMA_VISITA,
    },
  });
}

export async function findByCnpj(cnpj: string): Promise<Client | null> {
  return prisma.client.findUnique({ where: { cnpj } });
}

export async function findById(id: string): Promise<ClientComContatos | null> {
  return prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ principal: 'desc' }, { nome: 'asc' }] },
      visits: SELECT_ULTIMA_VISITA,
      representante: { select: { id: true, nome: true } },
      scheduleChanges: {
        orderBy: { data: 'desc' },
        include: { user: { select: { id: true, nome: true } } },
      },
    },
  });
}

/**
 * Lista clientes com o contato principal (quando existir) já embutido,
 * pronta para a projeção do contrato `GET /clients` (ver client.service.ts).
 */
export async function list(params: { search?: string; ativoFiltro: AtivoFiltro }): Promise<ClientComContatoPrincipal[]> {
  const filtros: Prisma.ClientWhereInput[] = [];

  if (params.ativoFiltro === 'ativos') {
    filtros.push({ ativo: true });
  }

  if (params.search) {
    filtros.push({
      OR: [
        { nomeFantasia: { contains: params.search, mode: 'insensitive' } },
        { razaoSocial: { contains: params.search, mode: 'insensitive' } },
        { cidade: { contains: params.search, mode: 'insensitive' } },
      ],
    });
  }

  return prisma.client.findMany({
    where: filtros.length > 0 ? { AND: filtros } : undefined,
    include: {
      contacts: {
        where: { principal: true },
        take: 1,
        select: { nome: true, telefone: true },
      },
      visits: SELECT_ULTIMA_VISITA,
      representante: { select: { id: true, nome: true } },
    },
    orderBy: { nomeFantasia: 'asc' },
  });
}

/**
 * Cria o cliente e seus contatos numa única transação: o índice único
 * parcial `one_principal_per_client` (client_id) WHERE principal, definido
 * na migration, é a última linha de defesa contra dois contatos principais
 * concorrentes, mas a regra "exatamente um principal" já é garantida antes
 * disso pelo zod (createClientSchema).
 */
export async function createWithContacts(input: CreateClientInput, representanteId: string): Promise<string> {
  const { contatos, ...dadosCliente } = input;

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: { ...dadosCliente, representanteId } });

    await tx.contact.createMany({
      data: contatos.map((contato) => ({ ...contato, clientId: client.id })),
    });

    return client.id;
  });
}

export async function update(id: string, data: UpdateClientInput): Promise<Client> {
  return prisma.client.update({ where: { id }, data });
}

/**
 * Única via de alteração de `Client.recorrenciaDias` (UC09): grava o
 * histórico auditável em `VisitScheduleChange` e atualiza o cliente na
 * mesma transação, para que nunca exista mudança de recorrência sem o
 * respectivo registro de justificativa.
 */
export async function updateRecorrenciaComHistorico(params: {
  clientId: string;
  userId: string;
  anterior: number;
  nova: number;
  justificativa: string;
}): Promise<void> {
  const { clientId, userId, anterior, nova, justificativa } = params;

  await prisma.$transaction([
    prisma.visitScheduleChange.create({
      data: {
        clientId,
        userId,
        recorrenciaAnterior: anterior,
        recorrenciaNova: nova,
        justificativa,
        data: new Date(),
      },
    }),
    prisma.client.update({ where: { id: clientId }, data: { recorrenciaDias: nova } }),
  ]);
}
