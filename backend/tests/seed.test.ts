import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { buscarProduto } from '../src/services/erp.service';
import { reiniciarDemonstracao, semear } from '../src/seed/demonstracao';
import { truncateAllTables } from './helpers/db';

const SENHA_DEMONSTRACAO = 'chokocrm123';
const EMAILS_DEMONSTRACAO = ['eduarda@chokolaten.com.br', 'rafael@chokolaten.com.br', 'gestor@chokolaten.com.br'];

/** 12:00 em São Paulo: o dia de calendário é o mesmo em UTC e em SP. */
const HOJE = new Date('2026-10-19T15:00:00.000Z');

function dia(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

async function totais() {
  return {
    usuarios: await prisma.user.count(),
    clientes: await prisma.client.count(),
    contatos: await prisma.contact.count(),
    visitas: await prisma.visit.count(),
    itens: await prisma.visitItem.count(),
    campanhas: await prisma.campaign.count(),
    metas: await prisma.goal.count(),
    proximasVisitas: await prisma.client.count({ where: { proximaVisita: { not: null } } }),
    visitasEmCampanha: await prisma.visit.count({ where: { campanhaId: { not: null } } }),
    eventosSazonais: await prisma.seasonalEvent.count(),
  };
}

/** Usuário "criado pelo app" (fora da lista de demonstração), com cliente, meta e token próprios. */
async function criarDadosDoApp(): Promise<{ id: string; senhaHash: string }> {
  const senhaHash = await bcrypt.hash('senha-da-empresa', 4);
  const usuario = await prisma.user.create({
    data: {
      nome: 'Joana Representante',
      email: 'joana@empresa.com.br',
      senhaHash,
      role: 'REPRESENTANTE',
      telefone: '(47) 98888-0000',
    },
  });
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Loja da Joana Ltda',
      nomeFantasia: 'Loja da Joana',
      cnpj: '99888777000155',
      cidade: 'Gaspar',
      endereco: 'Rua Itajaí, 10 - Centro, Gaspar/SC',
      telefone: '(47) 3333-0000',
      email: 'contato@lojadajoana.com.br',
      representanteId: usuario.id,
    },
  });
  await prisma.visit.create({
    data: {
      clientId: cliente.id,
      userId: usuario.id,
      dataHora: HOJE,
      descricao: 'Visita registrada pelo app.',
      resultado: 'SEM_VENDA',
    },
  });
  await prisma.campaign.create({
    data: { nome: 'Campanha criada pelo app', tipo: 'CAMPANHA', inicio: HOJE, fim: HOJE, produtos: [] },
  });
  await prisma.goal.create({
    data: {
      representanteId: usuario.id,
      periodo: 'PERSONALIZADO',
      inicio: HOJE,
      fim: HOJE,
      metaVisitas: 1,
      metaVendas: 100,
    },
  });
  await prisma.passwordResetToken.create({
    data: { userId: usuario.id, tokenHash: 'hash-de-teste', expiraEm: HOJE },
  });
  return { id: usuario.id, senhaHash };
}

describe('seed de demonstração', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('reiniciarDemonstracao recria clientes, visitas com pedido, campanhas, metas e próximas visitas', async () => {
    await reiniciarDemonstracao(prisma, HOJE);

    expect(await totais()).toEqual({
      usuarios: 3,
      clientes: 13,
      contatos: 15,
      visitas: 10,
      itens: 8,
      campanhas: 3,
      metas: 3,
      proximasVisitas: 3,
      visitasEmCampanha: 3,
      eventosSazonais: 10,
    });

    const usuarios = await prisma.user.findMany();
    expect(usuarios.every((usuario) => usuario.telefone && usuario.ativo)).toBe(true);

    // Todas as visitas de venda têm pedido de 2 itens do catálogo, com o preço do catálogo
    const visitas = await prisma.visit.findMany({ include: { itens: true } });
    for (const visita of visitas) {
      expect(visita.itens).toHaveLength(visita.resultado === 'VENDA' ? 2 : 0);
      for (const item of visita.itens) {
        const produto = buscarProduto(item.sku);
        expect(produto).not.toBeNull();
        expect(item.produtoNome).toBe(produto?.nome);
        expect(item.precoUnitario.toNumber()).toBe(produto?.precoUnitario);
        expect(item.quantidade).toBeGreaterThan(0);
      }
    }

    const campanhas = await prisma.campaign.findMany({ orderBy: { inicio: 'asc' } });
    expect(campanhas.map((campanha) => [campanha.nome, dia(campanha.inicio), dia(campanha.fim)])).toEqual([
      ['Feira Sabores do Vale — Blumenau', '2026-10-18', '2026-10-20'],
      ['Natal Chokolaten 2026', '2026-11-03', '2026-12-24'],
      ['Black Friday do Cacau', '2026-11-23', '2026-11-29'],
    ]);
    for (const campanha of campanhas) {
      expect(campanha.produtos.length).toBeGreaterThan(0);
      expect(campanha.produtos.every((sku) => buscarProduto(sku) !== null)).toBe(true);
    }
    expect(campanhas.some((campanha) => (campanha.desconto ?? 0) > 0)).toBe(true);

    const feira = campanhas[0];
    const metas = await prisma.goal.findMany({ include: { representante: true } });
    const mensais = metas.filter((meta) => meta.periodo === 'MENSAL');
    expect(mensais.map((meta) => meta.representante.email).sort()).toEqual([
      'eduarda@chokolaten.com.br',
      'rafael@chokolaten.com.br',
    ]);
    expect(mensais.every((meta) => dia(meta.inicio) === '2026-10-01' && dia(meta.fim) === '2026-10-31')).toBe(true);
    const daCampanha = metas.filter((meta) => meta.periodo === 'CAMPANHA');
    expect(daCampanha).toHaveLength(1);
    expect(daCampanha[0]?.campanhaId).toBe(feira?.id);

    const comProximaVisita = await prisma.client.findMany({ where: { proximaVisita: { not: null } } });
    expect(comProximaVisita.every((cliente) => cliente.lembrete)).toBe(true);
    expect(comProximaVisita.filter((cliente) => cliente.proximaCampanhaId)).toHaveLength(1);
    expect(comProximaVisita.every((cliente) => dia(cliente.proximaVisita as Date) > '2026-10-19')).toBe(true);
  });

  it('apaga o que o app gravou, mas mantém o usuário criado pelo app com a mesma senha', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    const joana = await criarDadosDoApp();

    await reiniciarDemonstracao(prisma, HOJE);

    const mantido = await prisma.user.findUnique({ where: { id: joana.id } });
    expect(mantido?.senhaHash).toBe(joana.senhaHash);
    expect(mantido?.email).toBe('joana@empresa.com.br');
    expect(await prisma.client.count({ where: { cnpj: '99888777000155' } })).toBe(0);
    expect(await prisma.campaign.count({ where: { nome: 'Campanha criada pelo app' } })).toBe(0);
    expect(await prisma.passwordResetToken.count()).toBe(0);
    expect(await prisma.goal.count({ where: { representanteId: joana.id } })).toBe(0);
    expect(await prisma.user.count()).toBe(4);
  });

  it('devolve as contas de demonstração à senha de demonstração e as reativa', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    await prisma.user.update({
      where: { email: 'eduarda@chokolaten.com.br' },
      data: { senhaHash: await bcrypt.hash('outra-senha', 4), nome: 'Outro nome', ativo: false },
    });

    await reiniciarDemonstracao(prisma, HOJE);

    for (const email of EMAILS_DEMONSTRACAO) {
      const usuario = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await bcrypt.compare(SENHA_DEMONSTRACAO, usuario.senhaHash)).toBe(true);
      expect(usuario.ativo).toBe(true);
    }
    const eduarda = await prisma.user.findUniqueOrThrow({ where: { email: 'eduarda@chokolaten.com.br' } });
    expect(eduarda.nome).toBe('Eduarda Fischer');
  });

  it('se o reinício falha no meio, nada é apagado (uma transação só)', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    const antes = await totais();
    const joana = await criarDadosDoApp();

    // Data inválida: os deletes já rodaram quando o `semear` falha ao calcular o dia.
    await expect(reiniciarDemonstracao(prisma, new Date('data inválida'))).rejects.toThrow();

    expect(await prisma.client.count({ where: { cnpj: '99888777000155' } })).toBe(1);
    expect(await prisma.passwordResetToken.count({ where: { userId: joana.id } })).toBe(1);
    expect(await totais()).toEqual({
      ...antes,
      usuarios: antes.usuarios + 1,
      clientes: antes.clientes + 1,
      visitas: antes.visitas + 1,
      campanhas: antes.campanhas + 1,
      metas: antes.metas + 1,
    });
  });

  it('rodar o reinício duas vezes seguidas dá os mesmos totais', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    const primeira = await totais();

    await reiniciarDemonstracao(prisma, HOJE);

    expect(await totais()).toEqual(primeira);
  });

  it('semear só acrescenta: não duplica nem apaga o que já existe', async () => {
    await semear(prisma, HOJE);
    const primeira = await totais();
    const joana = await criarDadosDoApp();

    await semear(prisma, HOJE);

    const segunda = await totais();
    expect(segunda).toEqual({
      ...primeira,
      usuarios: primeira.usuarios + 1,
      clientes: primeira.clientes + 1,
      visitas: primeira.visitas + 1,
      campanhas: primeira.campanhas + 1,
      metas: primeira.metas + 1,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: joana.id } })).senhaHash).toBe(joana.senhaHash);
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it('a demonstração de hoje mostra as quatro cores e um cliente rebaixado pelo ERP', async () => {
    await reiniciarDemonstracao(prisma, new Date());
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'gestor@chokolaten.com.br', senha: SENHA_DEMONSTRACAO });

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    const clientes = res.body.data as { cor: string; rebaixadoPorVenda: boolean }[];
    expect(new Set(clientes.map((cliente) => cliente.cor))).toEqual(
      new Set(['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO']),
    );
    expect(clientes.some((cliente) => cliente.rebaixadoPorVenda)).toBe(true);
  });
});
