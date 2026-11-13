import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
        usuario: 'smoke.user',
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
        representanteId: user.id,
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
    const representante = await prisma.user.create({
      data: {
        nome: 'Eduarda Representante Dois',
        usuario: 'smoke.user-dois',
        senhaHash: 'hash-fake',
        role: 'REPRESENTANTE',
      },
    });

    const client = await prisma.client.create({
      data: {
        razaoSocial: 'Smoke Teste Dois Ltda',
        nomeFantasia: 'Smoke Teste Dois',
        cnpj: '00000000000200',
        cidade: 'Joinville',
        endereco: 'Rua de Teste, 200',
        telefone: '(47) 3333-3333',
        email: 'contato@smoketestedois.com.br',
        representanteId: representante.id,
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

  it('cria Visit com resultado, foto e marca de edição', async () => {
    const user = await prisma.user.create({
      data: {
        nome: 'Eduarda Visita',
        usuario: 'smoke.visita',
        senhaHash: 'hash-fake',
        role: 'REPRESENTANTE',
      },
    });

    const client = await prisma.client.create({
      data: {
        razaoSocial: 'Visita Smoke Comércio Ltda',
        nomeFantasia: 'Visita Smoke',
        cnpj: '00000000000300',
        cidade: 'Pomerode',
        endereco: 'Rua de Teste, 300',
        telefone: '(47) 0000-0001',
        email: 'contato@visitasmoke.com.br',
        representanteId: user.id,
      },
    });

    const visita = await prisma.visit.create({
      data: {
        clientId: client.id,
        userId: user.id,
        dataHora: new Date('2026-09-20T13:00:00.000Z'),
        descricao: 'Reposição do mostruário.',
        resultado: 'VENDA',
      },
    });

    expect(visita.resultado).toBe('VENDA');
    expect(visita.fotoPath).toBeNull();
    expect(visita.editadoEm).toBeNull();
    expect(visita.criadoEm).toBeInstanceOf(Date);
  });

  it('cria Reminder (lembretes): texto até 200 no banco, cai com o cliente e só desvincula da visita', async () => {
    const user = await prisma.user.create({
      data: {
        nome: 'Eduarda Lembrete',
        usuario: 'smoke.lembrete',
        senhaHash: 'hash-fake',
        role: 'REPRESENTANTE',
      },
    });
    const client = await prisma.client.create({
      data: {
        razaoSocial: 'Lembrete Smoke Comércio Ltda',
        nomeFantasia: 'Lembrete Smoke',
        cnpj: '00000000000400',
        cidade: 'Pomerode',
        endereco: 'Rua de Teste, 400',
        telefone: '(47) 0000-0002',
        email: 'contato@lembretesmoke.com.br',
        representanteId: user.id,
      },
    });
    const visita = await prisma.visit.create({
      data: {
        clientId: client.id,
        userId: user.id,
        dataHora: new Date('2026-10-20T13:00:00.000Z'),
        descricao: 'Visita com lembrete.',
        resultado: 'NEGOCIACAO',
      },
    });

    const lembrete = await prisma.reminder.create({
      data: {
        clientId: client.id,
        criadoPorId: user.id,
        visitId: visita.id,
        texto: 'Levar amostras',
        data: new Date('2026-10-25T00:00:00.000Z'),
      },
    });
    expect(lembrete.concluidoEm).toBeNull();
    expect(lembrete.criadoEm).toBeInstanceOf(Date);

    // CHECK escrito à mão na migration
    await expect(
      prisma.reminder.create({
        data: { clientId: client.id, criadoPorId: user.id, texto: 'a'.repeat(201), data: new Date('2026-10-25') },
      }),
    ).rejects.toThrow();

    await prisma.visit.delete({ where: { id: visita.id } });
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: lembrete.id } })).visitId).toBeNull();

    await prisma.client.delete({ where: { id: client.id } });
    expect(await prisma.reminder.count()).toBe(0);
  });
});

/**
 * A migration não roda dentro do teste. O bloco que converte os e-mails em
 * usuários é lido do arquivo e executado sobre contas gravadas com o e-mail
 * antigo na coluna `usuario`, que é o estado logo depois de renomear a coluna.
 */
describe('Migration usuario_no_lugar_do_email (conversão dos e-mails)', () => {
  const ARQUIVO = join(
    __dirname,
    '..',
    'prisma',
    'migrations',
    '20261113120000_usuario_no_lugar_do_email',
    'migration.sql',
  );

  function blocoDeConversao(): string {
    const bloco = /DO \$\$[\s\S]*END \$\$;/.exec(readFileSync(ARQUIVO, 'utf8'));
    if (!bloco) throw new Error('Bloco de conversão não encontrado na migration.');
    return bloco[0];
  }

  async function converter(emails: readonly string[]): Promise<string[]> {
    for (const [ordem, email] of emails.entries()) {
      await prisma.user.create({
        data: {
          nome: `Conta ${ordem + 1}`,
          usuario: email,
          senhaHash: 'hash-fake',
          role: 'REPRESENTANTE',
          criadoEm: new Date(Date.UTC(2026, 0, 1 + ordem)),
        },
      });
    }
    await prisma.$executeRawUnsafe(blocoDeConversao());
    const contas = await prisma.user.findMany({ orderBy: { criadoEm: 'asc' } });
    return contas.map((conta) => conta.usuario);
  }

  it('usa a parte antes do @ em minúsculas, numera o repetido e completa o prefixo curto', async () => {
    expect(await converter(['ana.silva@x.com', 'ANA.SILVA@y.com', 'a@x.com'])).toEqual([
      'ana.silva',
      'ana.silva2',
      'ausuario',
    ]);
  });

  it('todo usuário gerado é único e válido, mesmo com sufixo já ocupado, caractere fora do padrão e prefixo longo', async () => {
    const usuarios = await converter([
      'ana.silva@x.com',
      'ana.silva@y.com',
      'ana.silva2@z.com',
      'José+Vendas@x.com',
      '+@x.com',
      'um.nome.muito.comprido.de.representante@x.com',
      'um.nome.muito.comprido.de.representante@y.com',
    ]);

    expect(usuarios).toEqual([
      'ana.silva',
      'ana.silva2',
      'ana.silva22',
      'josvendas',
      'usuario',
      'um.nome.muito.comprido.de.repr',
      'um.nome.muito.comprido.de.rep2',
    ]);
    expect(new Set(usuarios).size).toBe(usuarios.length);
    for (const usuario of usuarios) {
      expect(usuario).toMatch(/^[a-z0-9._-]{3,30}$/);
    }
  });

  it('rodar de novo não muda quem já tem usuário', async () => {
    const primeira = await converter(['ana.silva@x.com', 'ana.silva@y.com']);
    await prisma.$executeRawUnsafe(blocoDeConversao());
    const contas = await prisma.user.findMany({ orderBy: { criadoEm: 'asc' } });

    expect(contas.map((conta) => conta.usuario)).toEqual(primeira);
  });
});
