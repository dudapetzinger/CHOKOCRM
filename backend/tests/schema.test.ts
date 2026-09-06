import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('Schema Prisma (smoke)', () => {
  it('cria User e Client com contatos e lê de volta', async () => {
    const user = await prisma.user.create({
      data: {
        nome: 'Eduarda Representante',
        email: 'smoke.user@chokolaten.com.br',
        senhaHash: 'hash-fake',
        role: 'REPRESENTANTE',
      },
    });

    const client = await prisma.client.create({
      data: {
        razaoSocial: 'Smoke Teste Comércio Ltda',
        nomeFantasia: 'Smoke Teste',
        cnpj: '00000000000100',
        cidade: 'Blumenau',
        endereco: 'Rua de Teste, 100',
        telefone: '(47) 0000-0000',
        email: 'contato@smoketeste.com.br',
        contacts: {
          create: [
            { nome: 'Contato Principal', cargo: 'Compradora', telefone: '(47) 1111-1111', email: 'principal@smoketeste.com.br', principal: true },
            { nome: 'Contato Secundário', cargo: 'Proprietário', telefone: '(47) 2222-2222', email: 'secundario@smoketeste.com.br', principal: false },
          ],
        },
      },
      include: { contacts: true },
    });

    expect(user.id).toBeDefined();
    expect(client.contacts).toHaveLength(2);

    const found = await prisma.client.findUniqueOrThrow({
      where: { id: client.id },
      include: { contacts: true },
    });
    expect(found.nomeFantasia).toBe('Smoke Teste');
    expect(found.contacts.filter((c) => c.principal)).toHaveLength(1);
  });

  it('rejeita um segundo contato principal para o mesmo cliente', async () => {
    const client = await prisma.client.create({
      data: {
        razaoSocial: 'Smoke Teste Dois Ltda',
        nomeFantasia: 'Smoke Teste Dois',
        cnpj: '00000000000200',
        cidade: 'Joinville',
        endereco: 'Rua de Teste, 200',
        telefone: '(47) 3333-3333',
        email: 'contato@smoketestedois.com.br',
        contacts: {
          create: [
            { nome: 'Primeiro Principal', cargo: 'Compradora', telefone: '(47) 4444-4444', email: 'primeiro@smoketestedois.com.br', principal: true },
          ],
        },
      },
    });

    await expect(
      prisma.contact.create({
        data: {
          clientId: client.id,
          nome: 'Segundo Principal',
          cargo: 'Proprietário',
          telefone: '(47) 5555-5555',
          email: 'segundo@smoketestedois.com.br',
          principal: true,
        },
      }),
    ).rejects.toThrow();
  });
});
