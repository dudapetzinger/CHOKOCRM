import type { Client, Contact, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateClientInput, UpdateClientInput } from '../schemas/client.schema';

export type AtivoFiltro = 'ativos' | 'todos';

export type ClientComContatoPrincipal = Client & {
  contacts: Pick<Contact, 'nome' | 'telefone'>[];
};

export type ClientComContatos = Client & { contacts: Contact[] };

export async function findByCnpj(cnpj: string): Promise<Client | null> {
  return prisma.client.findUnique({ where: { cnpj } });
}

export async function findById(id: string): Promise<ClientComContatos | null> {
  return prisma.client.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ principal: 'desc' }, { nome: 'asc' }] },
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
export async function createWithContacts(input: CreateClientInput): Promise<string> {
  const { contatos, ...dadosCliente } = input;

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: dadosCliente });

    await tx.contact.createMany({
      data: contatos.map((contato) => ({ ...contato, clientId: client.id })),
    });

    return client.id;
  });
}

export async function update(id: string, data: UpdateClientInput): Promise<Client> {
  return prisma.client.update({ where: { id }, data });
}
