import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { ERP_IDS_DEMONSTRACAO } from '../src/config/erpIdsDemonstracao';
import { prisma } from '../src/lib/prisma';
import { CATALOGO } from '../src/providers/erp/mock/catalogo';
import { perfilDoErpId } from '../src/providers/erp/mock/gerador';
import { EMAIL_GESTAO, reiniciarDemonstracao, semear } from '../src/seed/demonstracao';
import { dataCalendario, diasEntre } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

const SENHA_DEMONSTRACAO = 'chokocrm123';
/** Contas de demonstração que voltam à senha de demonstração no reset (a conta Gestão não: é uma conta real). */
const EMAILS_DEMONSTRACAO = ['eduarda@chokolaten.com.br', 'rafael@chokolaten.com.br'];
/** Conta pessoal do gestor das versões anteriores do seed: o seed a inativa quando existe. */
const EMAIL_GESTOR_ANTIGO = 'gestor@chokolaten.com.br';

const horaEmSaoPaulo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `HH:MM` do instante em São Paulo. */
function horario(instante: Date): string {
  return horaEmSaoPaulo.format(instante);
}

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
    lembretesAbertos: await prisma.reminder.count({ where: { concluidoEm: null } }),
    lembretesConcluidos: await prisma.reminder.count({ where: { concluidoEm: { not: null } } }),
    eventosSazonais: await prisma.seasonalEvent.count(),
  };
}

/** Usuário "criado pelo app" (fora da lista de demonstração), com cliente, lembrete, meta e token próprios. */
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
  await prisma.reminder.create({
    data: { clientId: cliente.id, criadoPorId: usuario.id, texto: 'Lembrete criado pelo app.', data: HOJE },
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

afterAll(async () => {
  await prisma.$disconnect();
});

describe('seed de demonstração', () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  it('reiniciarDemonstracao recria clientes, visitas com pedido, campanhas, metas, próximas visitas e lembretes', async () => {
    await reiniciarDemonstracao(prisma, HOJE);

    expect(await totais()).toEqual({
      usuarios: 3,
      clientes: 26,
      contatos: 37,
      visitas: 57,
      itens: 77,
      campanhas: 3,
      metas: 3,
      proximasVisitas: 3,
      visitasEmCampanha: 3,
      lembretesAbertos: 3,
      lembretesConcluidos: 1,
      eventosSazonais: 10,
    });

    const usuarios = await prisma.user.findMany();
    expect(usuarios.every((usuario) => usuario.telefone && usuario.ativo)).toBe(true);

    // Histórico antigo (5 a 11 meses): vendas fora dos 90 dias, para o Painel em 365 dias; nunca a mais recente do cliente
    const antigas = await prisma.visit.findMany({
      where: { dataHora: { lt: new Date(HOJE.getTime() - 90 * 86_400_000) } },
      orderBy: { dataHora: 'asc' },
    });
    expect(antigas).toHaveLength(5);
    expect(antigas.every((visita) => visita.resultado === 'VENDA')).toBe(true);
    expect(antigas.every((visita) => visita.dataHora >= new Date(HOJE.getTime() - 365 * 86_400_000))).toBe(true);
    for (const antiga of antigas) {
      const maisRecente = await prisma.visit.findFirst({
        where: { clientId: antiga.clientId },
        orderBy: { dataHora: 'desc' },
      });
      expect(maisRecente?.id).not.toBe(antiga.id);
    }

    const campanhas = await prisma.campaign.findMany({ orderBy: { inicio: 'asc' } });
    expect(campanhas.map((campanha) => [campanha.nome, dia(campanha.inicio), dia(campanha.fim)])).toEqual([
      ['Feira Sabores do Vale — Blumenau', '2026-10-18', '2026-10-20'],
      ['Natal Chokolaten 2026', '2026-11-03', '2026-12-24'],
      ['Black Friday do Cacau', '2026-11-23', '2026-11-29'],
    ]);
    for (const campanha of campanhas) {
      expect(campanha.produtos.length).toBeGreaterThan(0);
      expect(campanha.produtos.every((sku) => CATALOGO.some((produto) => produto.sku === sku))).toBe(true);
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
    expect(comProximaVisita.filter((cliente) => cliente.proximaCampanhaId)).toHaveLength(1);
    // Duas adiante e uma marcada que já venceu (há 2 dias)
    expect(comProximaVisita.map((cliente) => dia(cliente.proximaVisita as Date)).sort()).toEqual([
      '2026-10-17',
      '2026-10-21',
      '2026-10-22',
    ]);
    // A marcada vencida fica na Doceria Jaraguá (última visita há 20 dias, nenhuma depois); o
    // Empório do Chocolate, visitado ontem, segue a recorrência (Etapa 10d)
    const porEmail = new Map(comProximaVisita.map((cliente) => [cliente.email, dia(cliente.proximaVisita as Date)]));
    expect(porEmail.get('contato@doceriajaragua.com.br')).toBe('2026-10-17');
    expect(porEmail.get('contato@cafeblumenau.com.br')).toBe('2026-10-21');
    expect(porEmail.get('contato@emporiodovalebrusque.com.br')).toBe('2026-10-22');
    expect(porEmail.has('contato@emporiodochocolate.com.br')).toBe(false);

    // Lembretes: três abertos (um vencido há 3 dias), um concluído, todos do dono da carteira
    const lembretes = await prisma.reminder.findMany({ include: { client: true }, orderBy: { data: 'asc' } });
    const abertos = lembretes.filter((lembrete) => lembrete.concluidoEm === null);
    expect(abertos.map((lembrete) => dia(lembrete.data))).toEqual(['2026-10-16', '2026-10-21', '2026-10-25']);
    expect(lembretes.every((lembrete) => lembrete.criadoPorId === lembrete.client.representanteId)).toBe(true);
    expect(lembretes.every((lembrete) => lembrete.texto.length > 0 && lembrete.texto.length <= 200)).toBe(true);

    // O lembrete saiu do cliente: a coluna não existe mais
    const colunas = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'`;
    expect(colunas.map((coluna) => coluna.column_name)).not.toContain('lembrete');
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
    expect(await prisma.reminder.count({ where: { texto: 'Lembrete criado pelo app.' } })).toBe(0);
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
      lembretesAbertos: antes.lembretesAbertos + 1,
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
      lembretesAbertos: primeira.lembretesAbertos + 1,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: joana.id } })).senhaHash).toBe(joana.senhaHash);
    expect(await prisma.passwordResetToken.count()).toBe(1);
  });

  it('cria a conta compartilhada Gestão Chokolaten (GESTOR, ativa) e não cria a conta antiga do gestor', async () => {
    await reiniciarDemonstracao(prisma, HOJE);

    expect(EMAIL_GESTAO).toBe('gestao@chokolaten.com.br');
    const gestao = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_GESTAO } });
    expect(gestao).toMatchObject({ nome: 'Gestão Chokolaten', role: 'GESTOR', telefone: '(47) 3387-0000', ativo: true });
    // Banco novo: a conta nasce com a senha de demonstração
    expect(await bcrypt.compare(SENHA_DEMONSTRACAO, gestao.senhaHash)).toBe(true);
    expect(await prisma.user.count({ where: { email: EMAIL_GESTOR_ANTIGO } })).toBe(0);
  });

  it('inativa a conta antiga do gestor quando ela existe, sem apagá-la', async () => {
    await prisma.user.create({
      data: {
        nome: 'Gestor de demonstração',
        email: EMAIL_GESTOR_ANTIGO,
        senhaHash: await bcrypt.hash(SENHA_DEMONSTRACAO, 4),
        role: 'GESTOR',
      },
    });

    await reiniciarDemonstracao(prisma, HOJE);

    const antiga = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_GESTOR_ANTIGO } });
    expect(antiga.ativo).toBe(false);
    // Eduarda, Rafael, Gestão e a conta antiga (inativa): o seed não apaga usuários
    expect(await prisma.user.count()).toBe(4);
    const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTOR_ANTIGO, senha: SENHA_DEMONSTRACAO });
    expect(login.status).not.toBe(200);
  });

  it('a conta Gestão já existente mantém a própria senha no reset e no semear, e volta a ficar ativa', async () => {
    const senhaHash = await bcrypt.hash('senha-do-escritorio', 4);
    await prisma.user.create({ data: { nome: 'Gestão', email: EMAIL_GESTAO, senhaHash, role: 'GESTOR', ativo: false } });

    await reiniciarDemonstracao(prisma, HOJE);

    const depoisDoReset = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_GESTAO } });
    expect(depoisDoReset.senhaHash).toBe(senhaHash);
    expect(depoisDoReset).toMatchObject({ nome: 'Gestão Chokolaten', role: 'GESTOR', ativo: true });

    await semear(prisma, HOJE);

    const depoisDoSemear = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_GESTAO } });
    expect(depoisDoSemear.senhaHash).toBe(senhaHash);
    expect(await prisma.user.count()).toBe(3);
  });

  it('visitas em horário comercial de São Paulo, nos mesmos dias de antes', async () => {
    await reiniciarDemonstracao(prisma, HOJE);

    const visitas = await prisma.visit.findMany({ orderBy: { dataHora: 'desc' } });
    const horarios = visitas.map((visita) => horario(visita.dataHora));
    expect(horarios.every((valor) => valor >= '08:00' && valor <= '18:59')).toBe(true);
    expect(new Set(horarios.map((valor) => valor.slice(3))).size).toBeGreaterThanOrEqual(5);
    expect(visitas.every((visita) => visita.dataHora <= HOJE)).toBe(true);

    // Os dias de calendário não mudam: as mesmas distâncias (em dias) de hoje que o seed sempre teve
    const hoje = dataCalendario(HOJE);
    expect(visitas.map((visita) => diasEntre(dataCalendario(visita.dataHora), hoje))).toEqual([
      1, 3, 4, 6, 8, 9, 9, 10, 10, 11, 11, 12, 13, 14, 16, 17, 18, 18, 20, 20, 20, 20, 22, 22, 23, 24, 25, 25, 25, 26,
      27, 28, 30, 30, 34, 35, 36, 38, 41, 41, 42, 46, 48, 52, 54, 55, 58, 58, 58, 77, 80, 85, 168, 200, 260, 290, 330,
    ]);

    // Determinístico: a 1ª visita do 1º cliente (índice 0) é às 08:00 e a 2ª (índice 1) às 11:17
    const mercado = await prisma.client.findFirstOrThrow({
      where: { email: 'contato@mercadocentraljoinville.com.br' },
      include: { visits: { orderBy: { dataHora: 'desc' } } },
    });
    expect(mercado.visits.slice(0, 2).map((visita) => horario(visita.dataHora))).toEqual(['08:00', '11:17']);
  });

  it('com o reset antes do expediente, nenhuma visita fica no futuro', async () => {
    // 07:30 em São Paulo
    const cedo = new Date('2026-10-19T10:30:00.000Z');

    await reiniciarDemonstracao(prisma, cedo);

    expect(await prisma.visit.count({ where: { dataHora: { gt: cedo } } })).toBe(0);
  });
});

const CIDADES_EDUARDA = ['Joinville', 'Jaraguá do Sul', 'Corupá', 'São Bento do Sul', 'Pomerode'];
const CIDADES_RAFAEL = ['Blumenau', 'Indaial', 'Timbó', 'Brusque', 'Itajaí', 'Rio do Sul'];
/** CNPJ real da parceira, usado nos testes de importação: o seed não pode colidir com ele. */
const CNPJ_DA_PARCEIRA = '25382906000149';

/** Dígito verificador do CNPJ pelo algoritmo oficial (módulo 11 com os pesos dados). */
function digitoVerificador(digitos: string, pesos: number[]): number {
  const soma = pesos.reduce((total, peso, indice) => total + Number(digitos[indice]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const primeiro = digitoVerificador(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${primeiro}${segundo}`);
}

describe('cadastro realista', () => {
  beforeAll(async () => {
    await truncateAllTables();
    await reiniciarDemonstracao(prisma, new Date());
  });

  async function clientesDoSeed() {
    return prisma.client.findMany({
      include: { representante: true, contacts: true },
      orderBy: { nomeFantasia: 'asc' },
    });
  }

  it('cria 26 clientes, 16 da Eduarda e 10 do Rafael, nas 11 cidades das rotas', async () => {
    const clientes = await clientesDoSeed();
    expect(clientes).toHaveLength(26);

    const daEduarda = clientes.filter((cliente) => cliente.representante.email === 'eduarda@chokolaten.com.br');
    const doRafael = clientes.filter((cliente) => cliente.representante.email === 'rafael@chokolaten.com.br');
    expect(daEduarda).toHaveLength(16);
    expect(doRafael).toHaveLength(10);

    expect(daEduarda.every((cliente) => CIDADES_EDUARDA.includes(cliente.cidade))).toBe(true);
    expect(doRafael.every((cliente) => CIDADES_RAFAEL.includes(cliente.cidade))).toBe(true);
    const cidadesDasRotas = new Set([...CIDADES_EDUARDA, ...CIDADES_RAFAEL]);
    expect([...new Set(clientes.map((cliente) => cliente.cidade))].every((cidade) => cidadesDasRotas.has(cidade))).toBe(
      true,
    );
  });

  it('todo cliente tem CNPJ válido e único, razão social diferente do nome fantasia, telefone de SC e e-mail único', async () => {
    const clientes = await clientesDoSeed();

    for (const cliente of clientes) {
      expect({ nome: cliente.nomeFantasia, valido: cnpjValido(cliente.cnpj) }).toEqual({
        nome: cliente.nomeFantasia,
        valido: true,
      });
      expect(cliente.cnpj).not.toBe(CNPJ_DA_PARCEIRA);
      expect(cliente.razaoSocial).not.toBe(cliente.nomeFantasia);
      expect(cliente.telefone).toMatch(/^\(47\) (3\d{3}|9\d{4})-\d{4}$/);
      expect(cliente.endereco).toContain(', ');
      expect(cliente.endereco).toContain('/SC');
    }
    expect(new Set(clientes.map((cliente) => cliente.cnpj)).size).toBe(clientes.length);
    expect(new Set(clientes.map((cliente) => cliente.email)).size).toBe(clientes.length);
    expect(new Set(clientes.map((cliente) => cliente.telefone)).size).toBe(clientes.length);
  });

  it('todo cliente tem 1 ou 2 contatos com cargo e exatamente um principal', async () => {
    const clientes = await clientesDoSeed();

    for (const cliente of clientes) {
      expect(cliente.contacts.length).toBeGreaterThanOrEqual(1);
      expect(cliente.contacts.length).toBeLessThanOrEqual(2);
      expect(cliente.contacts.every((contato) => contato.cargo.trim().length > 0)).toBe(true);
      expect(cliente.contacts.filter((contato) => contato.principal)).toHaveLength(1);
    }
  });

  it('erpId é código numérico de 5 dígitos e único, exceto os dois clientes sem ERP', async () => {
    const clientes = await clientesDoSeed();
    const semErp = ['Confeitaria Rota das Cachoeiras', 'Padaria Vale Europeu'];

    expect(clientes.filter((cliente) => cliente.erpId === null).map((cliente) => cliente.nomeFantasia)).toEqual(semErp);
    const comErp = clientes.filter((cliente) => cliente.erpId !== null).map((cliente) => cliente.erpId as string);
    expect(comErp).toHaveLength(24);
    for (const erpId of comErp) {
      expect(erpId).toMatch(/^\d{5}$/);
      expect(erpId).not.toMatch(/-0$/);
    }
    expect(new Set(comErp).size).toBe(24);
  });

  it('a calibração do ERP simulado dá 0 meses sem compra aos clientes em dia e 3 ou mais só ao Armazém São Bento', () => {
    const meses = (nomeFantasia: string): number => {
      const erpId = ERP_IDS_DEMONSTRACAO[nomeFantasia];
      if (!erpId) throw new Error(`${nomeFantasia} sem erpId na calibração.`);
      return perfilDoErpId(erpId).mesesSemCompra;
    };

    expect(meses('Armazém São Bento')).toBeGreaterThanOrEqual(3);
    expect(meses('Empório Pomerode')).toBe(0);
    expect(meses('Empório do Vale Brusque')).toBe(0);
    expect(meses('Mercearia Alto Vale')).toBe(0);

    const comTresOuMais = Object.entries(ERP_IDS_DEMONSTRACAO)
      .filter(([, erpId]) => erpId !== null && perfilDoErpId(erpId).mesesSemCompra >= 3)
      .map(([nomeFantasia]) => nomeFantasia);
    expect(comTresOuMais).toEqual(['Armazém São Bento']);
  });

  it('nenhum texto do seed tem marca de demonstração', async () => {
    const clientes = await clientesDoSeed();
    const marca = /ERP-|exemplo|teste|demo|\b(2|II)$/i;

    for (const cliente of clientes) {
      expect(cliente.nomeFantasia).not.toMatch(marca);
      expect(cliente.razaoSocial).not.toMatch(marca);
    }
  });
});

/**
 * Clientes cujo histórico foge da recorrência de propósito: os que têm venda
 * antiga (5 a 11 meses, para o Painel em 365 dias) depois de um longo
 * intervalo sem registro e o que nunca foi visitado (VERMELHO por falta de
 * visita). Os atrasados e a marcada vencida (Doceria Jaraguá) fogem da
 * recorrência só na data da próxima visita, não no intervalo entre visitas.
 */
const EXCECOES = [
  'contato@emporiopomerode.com.br', // duas vendas antigas
  'contato@mercadocentraljoinville.com.br', // venda antiga; atrasado (AMARELO)
  'contato@cafeblumenau.com.br', // venda antiga
  'contato@casadechasitajai.com.br', // venda antiga; atrasado (LARANJA)
  'contato@padariaconfeitariaindaial.com.br', // nunca visitado (VERMELHO por falta de visita)
];

const MS_POR_DIA = 86_400_000;

describe('histórico realista', () => {
  let agora: Date;

  beforeAll(async () => {
    await truncateAllTables();
    agora = new Date();
    await reiniciarDemonstracao(prisma, agora);
  });

  async function tokenDoGestor(): Promise<string> {
    const login = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
    return login.body.token;
  }

  it('todo cliente ativo tem pelo menos uma visita, e os intervalos entre visitas respeitam a recorrência', async () => {
    const clientes = await prisma.client.findMany({ include: { visits: { orderBy: { dataHora: 'asc' } } } });

    for (const cliente of clientes) {
      expect(cliente.recorrenciaDias).toBeGreaterThanOrEqual(7);
      expect(cliente.recorrenciaDias).toBeLessThanOrEqual(60);
      if (EXCECOES.includes(cliente.email ?? '')) continue;

      if (cliente.ativo) {
        expect({ cliente: cliente.nomeFantasia, temVisita: cliente.visits.length > 0 }).toEqual({
          cliente: cliente.nomeFantasia,
          temVisita: true,
        });
      }
      for (let i = 1; i < cliente.visits.length; i++) {
        const anterior = cliente.visits[i - 1] as { dataHora: Date };
        const atual = cliente.visits[i] as { dataHora: Date };
        const intervalo = Math.round((atual.dataHora.getTime() - anterior.dataHora.getTime()) / MS_POR_DIA);
        const dentro = intervalo >= 0.5 * cliente.recorrenciaDias && intervalo <= 1.5 * cliente.recorrenciaDias;
        expect({ cliente: cliente.nomeFantasia, intervalo, dentro }).toEqual({
          cliente: cliente.nomeFantasia,
          intervalo,
          dentro: true,
        });
      }
    }

    expect(new Set(clientes.map((cliente) => cliente.recorrenciaDias))).toEqual(new Set([7, 15, 30, 45, 60]));
    expect(clientes.filter((cliente) => !cliente.ativo)).toHaveLength(1);
  });

  it('pedidos têm de 1 a 4 itens só nas visitas de venda', async () => {
    const visitas = await prisma.visit.findMany({ include: { itens: true } });

    for (const visita of visitas) {
      if (visita.resultado === 'VENDA') {
        expect(visita.itens.length).toBeGreaterThanOrEqual(1);
        expect(visita.itens.length).toBeLessThanOrEqual(4);
      } else {
        expect(visita.itens).toHaveLength(0);
      }
      expect(new Set(visita.itens.map((item) => item.sku)).size).toBe(visita.itens.length);
      for (const item of visita.itens) {
        const produto = CATALOGO.find((candidato) => candidato.sku === item.sku);
        expect(produto).toBeDefined();
        expect(item.produtoNome).toBe(produto?.nome);
        expect(item.precoUnitario.toNumber()).toBe(produto?.precoUnitario);
        expect(item.quantidade).toBeGreaterThan(0);
      }
    }
    // Pedidos de tamanhos variados, não todos do mesmo jeito
    const tamanhos = new Set(
      visitas.filter((visita) => visita.resultado === 'VENDA').map((visita) => visita.itens.length),
    );
    expect(tamanhos.size).toBeGreaterThanOrEqual(3);
  });

  // O Armazém São Bento (VENDA há 9 dias) fica VERDE na base, e por isso rebaixado, do dia do
  // reinício até o dia +6: a apresentação, 1 a 2 dias depois do reset, ainda mostra o caso.
  it('a demonstração de hoje mostra as quatro cores e um cliente rebaixado pelo ERP', async () => {
    const res = await request(app).get('/clients').set('Authorization', `Bearer ${await tokenDoGestor()}`);

    expect(res.status).toBe(200);
    const clientes = res.body.data as { nomeFantasia: string; cor: string; rebaixadoPorVenda: boolean }[];
    expect(new Set(clientes.map((cliente) => cliente.cor))).toEqual(
      new Set(['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO']),
    );
    expect(clientes.filter((cliente) => cliente.rebaixadoPorVenda).map((cliente) => cliente.nomeFantasia)).toEqual([
      'Armazém São Bento',
    ]);
  });

  it('o cliente de recorrência semanal com visita há 4 dias fica VERDE', async () => {
    const semanal = await prisma.client.findFirstOrThrow({
      where: { email: 'contato@panificadoravilalenzi.com.br' },
      include: { visits: { orderBy: { dataHora: 'desc' } } },
    });
    expect(semanal.recorrenciaDias).toBe(7);
    expect(semanal.visits.length).toBeGreaterThanOrEqual(4);
    const ultima = semanal.visits[0] as { dataHora: Date };
    // Em dias de calendário: a hora da visita (horário comercial) e a do reset não mudam o dia
    expect(diasEntre(dataCalendario(ultima.dataHora), dataCalendario(agora))).toBe(4);

    const res = await request(app).get('/clients').set('Authorization', `Bearer ${await tokenDoGestor()}`);
    const item = (res.body.data as { id: string; cor: string }[]).find((cliente) => cliente.id === semanal.id);
    expect(item?.cor).toBe('VERDE');
  });

  it('dois clientes da mesma cidade com visita hoje aparecem uma vez cada na agenda do dia', async () => {
    const res = await request(app).get('/agenda/today').set('Authorization', `Bearer ${await tokenDoGestor()}`);

    expect(res.status).toBe(200);
    const hoje = res.body.data.hoje as { nomeFantasia: string; cidade: string }[];
    const deSaoBento = hoje.filter((item) => item.cidade === 'São Bento do Sul').map((item) => item.nomeFantasia);
    expect(deSaoBento.sort()).toEqual(['Café Colonial Serra Alta', 'Padaria Rainha da Serra']);
    const secoes = [
      ...res.body.data.atrasadas,
      ...res.body.data.hoje,
      ...res.body.data.proximos7Dias,
    ] as { nomeFantasia: string }[];
    for (const nome of deSaoBento) {
      expect(secoes.filter((item) => item.nomeFantasia === nome)).toHaveLength(1);
    }
  });

  it('cinco vendas antigas, três visitas de campanha, três próximas visitas e quatro lembretes', async () => {
    const antigas = await prisma.visit.findMany({
      where: { dataHora: { lt: new Date(agora.getTime() - 90 * MS_POR_DIA) } },
    });
    expect(antigas).toHaveLength(5);
    expect(antigas.every((visita) => visita.resultado === 'VENDA')).toBe(true);

    const emCampanha = await prisma.visit.findMany({
      where: { campanhaId: { not: null } },
      include: { campanha: true },
    });
    expect(emCampanha.map((visita) => visita.campanha?.nome.replace(/ \d{4}$/, '')).sort()).toEqual([
      'Feira Sabores do Vale — Blumenau',
      'Natal Chokolaten',
      'Natal Chokolaten',
    ]);

    const comProxima = await prisma.client.findMany({ where: { proximaVisita: { not: null } } });
    expect(comProxima.map((cliente) => cliente.email).sort()).toEqual([
      'contato@cafeblumenau.com.br',
      'contato@doceriajaragua.com.br',
      'contato@emporiodovalebrusque.com.br',
    ]);

    const lembretes = await prisma.reminder.findMany({ include: { client: true } });
    expect(lembretes).toHaveLength(4);
    expect(lembretes.filter((lembrete) => lembrete.concluidoEm !== null)).toHaveLength(1);

    // O cliente inativo guarda o histórico, mas não tem próxima visita nem lembrete
    const inativo = await prisma.client.findFirstOrThrow({ where: { ativo: false }, include: { visits: true } });
    expect(inativo.visits.length).toBeGreaterThan(0);
    expect(comProxima.some((cliente) => cliente.id === inativo.id)).toBe(false);
    expect(lembretes.some((lembrete) => lembrete.clientId === inativo.id)).toBe(false);

    // A carteira do Rafael não tem venda nos últimos 30 dias (contraste no painel)
    const vendasDoRafael = await prisma.visit.count({
      where: {
        resultado: 'VENDA',
        dataHora: { gte: new Date(agora.getTime() - 30 * MS_POR_DIA) },
        client: { representante: { email: 'rafael@chokolaten.com.br' } },
      },
    });
    expect(vendasDoRafael).toBe(0);
  });

  it('nenhuma visita no futuro e todas em horário comercial de São Paulo, com horários variados', async () => {
    const visitas = await prisma.visit.findMany();
    expect(visitas.every((visita) => visita.dataHora <= agora)).toBe(true);
    const horarios = visitas.map((visita) => horario(visita.dataHora));
    expect(horarios.every((valor) => valor >= '08:00' && valor <= '18:59')).toBe(true);
    expect(new Set(horarios).size).toBeGreaterThanOrEqual(5);
  });

  it('nenhuma descrição de visita ou texto de lembrete tem marca de demonstração', async () => {
    const marca = /ERP-|exemplo|teste|demo/i;
    const visitas = await prisma.visit.findMany();
    const lembretes = await prisma.reminder.findMany();

    for (const texto of [...visitas.map((visita) => visita.descricao), ...lembretes.map((lembrete) => lembrete.texto)]) {
      expect(texto).not.toMatch(marca);
    }
  });
});
