import type { Contact } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateContactInput, UpdateContactInput } from '../schemas/contact.schema';

export async function findById(id: string): Promise<Contact | null> {
  return prisma.contact.findUnique({ where: { id } });
}

/**
 * Cria o contato de um cliente já existente. Quando o novo contato é
 * marcado como principal, rebaixa o principal atual do cliente na mesma
 * transação e ANTES de criar o novo registro — o índice único parcial
 * `one_principal_per_client` (client_id) WHERE principal, definido na
 * migration, não tolera dois contatos principais simultâneos.
 */
export async function createPromovendoPrincipal(clientId: string, input: CreateContactInput): Promise<Contact> {
  return prisma.$transaction(async (tx) => {
    if (input.principal) {
      await tx.contact.updateMany({
        where: { clientId, principal: true },
        data: { principal: false },
      });
    }

    return tx.contact.create({ data: { ...input, clientId } });
  });
}

/**
 * Atualiza um contato existente. Quando a atualização promove o contato a
 * principal (`principal: true`), rebaixa qualquer outro contato principal
 * do mesmo cliente na mesma transação e antes de aplicar a atualização,
 * pela mesma razão do índice único parcial descrita em
 * `createPromovendoPrincipal`. Rebaixar o próprio (único) principal é
 * bloqueado antes de chegar aqui, em contact.service.ts.
 */
export async function updatePromovendoPrincipal(
  id: string,
  clientId: string,
  input: UpdateContactInput,
): Promise<Contact> {
  return prisma.$transaction(async (tx) => {
    if (input.principal === true) {
      await tx.contact.updateMany({
        where: { clientId, principal: true, NOT: { id } },
        data: { principal: false },
      });
    }

    return tx.contact.update({ where: { id }, data: input });
  });
}

export async function remove(id: string): Promise<void> {
  await prisma.contact.delete({ where: { id } });
}
