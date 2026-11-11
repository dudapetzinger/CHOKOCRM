import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { ERP_IDS_DEMONSTRACAO } from '../src/config/erpIdsDemonstracao';
import { prisma } from '../src/lib/prisma';
import { CATALOGO } from '../src/providers/erp/mock/catalogo';
import { perfilDoErpId } from '../src/providers/erp/mock/gerador';
import { CLIENTES_ANCORA, CLIENTES_GERADOS, EMAIL_GESTAO, reiniciarDemonstracao, semear } from '../src/seed/demonstracao';
import { dataCalendario, diasEntre, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

const SENHA_DEMONSTRACAO = 'chokocrm123';
/** Clientes da demonstração: os 26 âncoras escritos à mão e os gerados (cerca de 40 por representante). */
const CLIENTES_DA_DEMONSTRACAO = CLIENTES_ANCORA.length + CLIENTES_GERADOS.length;
/** Os 26 clientes âncora, com o cadastro de sempre (casos de propósito incluídos). */
const NOMES_DAS_ANCORAS = [
  'Mercado Central Joinville',
  'Cafeteria Estrada Bonita',
  'Confeitaria Dona Frida',
  'Café Rua das Palmeiras',
  'Mercearia Bom Retiro',
  'Doceria Jaraguá',
  'Panificadora Vila Lenzi',
  'Casa de Chá Recanto Alemão',
  'Confeitaria Rota das Cachoeiras',
  'Hotel Fazenda Rio Novo',
  'Armazém São Bento',
  'Café Colonial Serra Alta',
  'Padaria Rainha da Serra',
  'Empório Pomerode',
  'Empório do Chocolate',
  'Doceria Enxaimel',
  'Café Blumenau',
  'Confeitaria Vila Germânica',
  'Empório Itoupava',
  'Padaria Confeitaria Indaial',
  'Padaria Vale Europeu',
  'Hotel Fazenda Mulde',
  'Empório do Vale Brusque',
  'Casa de Chás Itajaí',
  'Café Beira-Rio',
  'Mercearia Alto Vale',
] as const;
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
    proximasVisitas: await prisma.client.count({
      where: { proximaVisita: { not: null } },
    }),
    visitasEmCampanha: await prisma.visit.count({
      where: { campanhaId: { not: null } },
    }),
    lembretesAbertos: await prisma.reminder.count({
      where: { concluidoEm: null },
    }),
    lembretesConcluidos: await prisma.reminder.count({
      where: { concluidoEm: { not: null } },
    }),
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
    data: {
      clientId: cliente.id,
      criadoPorId: usuario.id,
      texto: 'Lembrete criado pelo app.',
      data: HOJE,
    },
  });
  await prisma.campaign.create({
    data: {
      nome: 'Campanha criada pelo app',
      tipo: 'CAMPANHA',
      inicio: HOJE,
      fim: HOJE,
      produtos: [],
    },
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

    const t = await totais();
    expect(t).toMatchObject({
      usuarios: 3,
      clientes: CLIENTES_DA_DEMONSTRACAO,
      campanhas: 2,
      metas: 3,
      proximasVisitas: 3,
      lembretesAbertos: 3,
      lembretesConcluidos: 1,
      eventosSazonais: 10,
    });
    // ~25 visitas por semana por representante, 13 semanas (a corrente pela metade)
    expect(t.visitas).toBeGreaterThan(500);
    expect(t.visitas).toBeLessThan(700);
    expect(t.itens).toBeGreaterThan(t.visitas / 2);
    expect(t.visitasEmCampanha).toBeGreaterThan(0);

    const usuarios = await prisma.user.findMany();
    expect(usuarios.every((usuario) => usuario.telefone && usuario.ativo)).toBe(true);

    // Só as 13 semanas: nada antes da segunda-feira de 12 semanas atrás
    const maisAntiga = await prisma.visit.findFirstOrThrow({
      orderBy: { dataHora: 'asc' },
    });
    expect(dataCalendario(maisAntiga.dataHora)).toBe('2026-07-27');

    // A campanha sazonal do mês em andamento e a do mês seguinte, agendada
    const campanhas = await prisma.campaign.findMany({
      orderBy: { inicio: 'asc' },
    });
    expect(campanhas.map((campanha) => [campanha.nome, dia(campanha.inicio), dia(campanha.fim)])).toEqual([
      ['Oktoberfest Chokolaten 2026', '2026-10-01', '2026-10-31'],
      ['Encomendas de Natal 2026', '2026-11-01', '2026-11-30'],
    ]);
    for (const campanha of campanhas) {
      expect(campanha.produtos.length).toBeGreaterThan(0);
      expect(campanha.produtos.every((sku) => CATALOGO.some((produto) => produto.sku === sku))).toBe(true);
    }
    expect(campanhas.some((campanha) => (campanha.desconto ?? 0) > 0)).toBe(true);

    const atual = campanhas[0];
    const metas = await prisma.goal.findMany({
      include: { representante: true },
    });
    const mensais = metas.filter((meta) => meta.periodo === 'MENSAL');
    expect(mensais.map((meta) => meta.representante.email).sort()).toEqual([
      'eduarda@chokolaten.com.br',
      'rafael@chokolaten.com.br',
    ]);
    expect(mensais.every((meta) => dia(meta.inicio) === '2026-10-01' && dia(meta.fim) === '2026-10-31')).toBe(true);
    // 22 dias úteis em outubro de 2026, 5 visitas por dia
    expect(mensais.every((meta) => meta.metaVisitas === 110)).toBe(true);
    const daCampanha = metas.filter((meta) => meta.periodo === 'CAMPANHA');
    expect(daCampanha).toHaveLength(1);
    expect(daCampanha[0]?.campanhaId).toBe(atual?.id);

    const comProximaVisita = await prisma.client.findMany({
      where: { proximaVisita: { not: null } },
    });
    expect(comProximaVisita.filter((cliente) => cliente.proximaCampanhaId)).toHaveLength(1);
    // Duas adiante e uma marcada que já venceu (há 2 dias)
    const porEmail = new Map(comProximaVisita.map((cliente) => [cliente.email, dia(cliente.proximaVisita as Date)]));
    expect(porEmail.get('contato@doceriajaragua.com.br')).toBe('2026-10-17');
    expect(porEmail.get('contato@cafeblumenau.com.br')).toBe('2026-10-21');
    expect(porEmail.get('contato@emporiodovalebrusque.com.br')).toBe('2026-10-22');
    // A marcada vencida é posterior à última visita da Doceria (nenhuma visita depois de marcá-la)
    const doceria = await prisma.client.findFirstOrThrow({
      where: { email: 'contato@doceriajaragua.com.br' },
      include: { visits: { orderBy: { dataHora: 'desc' }, take: 1 } },
    });
    expect(dataCalendario((doceria.visits[0] as { dataHora: Date }).dataHora) < '2026-10-17').toBe(true);

    // Lembretes: três abertos (um vencido há 3 dias), um concluído, todos do dono da carteira
    const lembretes = await prisma.reminder.findMany({
      include: { client: true },
      orderBy: { data: 'asc' },
    });
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
    expect(
      await prisma.campaign.count({
        where: { nome: 'Campanha criada pelo app' },
      }),
    ).toBe(0);
    expect(await prisma.goal.count({ where: { representanteId: joana.id } })).toBe(0);
    expect(
      await prisma.reminder.count({
        where: { texto: 'Lembrete criado pelo app.' },
      }),
    ).toBe(0);
    expect(await prisma.user.count()).toBe(4);
  });

  it('devolve as contas de demonstração à senha de demonstração e as reativa', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    await prisma.user.update({
      where: { email: 'eduarda@chokolaten.com.br' },
      data: {
        senhaHash: await bcrypt.hash('outra-senha', 4),
        nome: 'Outro nome',
        ativo: false,
      },
    });

    await reiniciarDemonstracao(prisma, HOJE);

    for (const email of EMAILS_DEMONSTRACAO) {
      const usuario = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(await bcrypt.compare(SENHA_DEMONSTRACAO, usuario.senhaHash)).toBe(true);
      expect(usuario.ativo).toBe(true);
    }
    const eduarda = await prisma.user.findUniqueOrThrow({
      where: { email: 'eduarda@chokolaten.com.br' },
    });
    expect(eduarda.nome).toBe('Eduarda Fischer');
  });

  it('se o reinício falha no meio, nada é apagado (uma transação só)', async () => {
    await reiniciarDemonstracao(prisma, HOJE);
    const antes = await totais();
    await criarDadosDoApp();

    // Data inválida: os deletes já rodaram quando o `semear` falha ao calcular o dia.
    await expect(reiniciarDemonstracao(prisma, new Date('data inválida'))).rejects.toThrow();

    expect(await prisma.client.count({ where: { cnpj: '99888777000155' } })).toBe(1);
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
  });

  it('cria a conta compartilhada Gestão Chokolaten (GESTOR, ativa) e não cria a conta antiga do gestor', async () => {
    await reiniciarDemonstracao(prisma, HOJE);

    expect(EMAIL_GESTAO).toBe('gestao@chokolaten.com.br');
    const gestao = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_GESTAO },
    });
    expect(gestao).toMatchObject({
      nome: 'Gestão Chokolaten',
      role: 'GESTOR',
      telefone: '(47) 3387-0000',
      ativo: true,
    });
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

    const antiga = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_GESTOR_ANTIGO },
    });
    expect(antiga.ativo).toBe(false);
    // Eduarda, Rafael, Gestão e a conta antiga (inativa): o seed não apaga usuários
    expect(await prisma.user.count()).toBe(4);
    const login = await request(app)
      .post('/auth/login')
      .send({ email: EMAIL_GESTOR_ANTIGO, senha: SENHA_DEMONSTRACAO });
    expect(login.status).not.toBe(200);
  });

  it('a conta Gestão já existente mantém a própria senha no reset e no semear, e volta a ficar ativa', async () => {
    const senhaHash = await bcrypt.hash('senha-do-escritorio', 4);
    await prisma.user.create({
      data: {
        nome: 'Gestão',
        email: EMAIL_GESTAO,
        senhaHash,
        role: 'GESTOR',
        ativo: false,
      },
    });

    await reiniciarDemonstracao(prisma, HOJE);

    const depoisDoReset = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_GESTAO },
    });
    expect(depoisDoReset.senhaHash).toBe(senhaHash);
    expect(depoisDoReset).toMatchObject({
      nome: 'Gestão Chokolaten',
      role: 'GESTOR',
      ativo: true,
    });

    await semear(prisma, HOJE);

    const depoisDoSemear = await prisma.user.findUniqueOrThrow({
      where: { email: EMAIL_GESTAO },
    });
    expect(depoisDoSemear.senhaHash).toBe(senhaHash);
    expect(await prisma.user.count()).toBe(3);
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

  it('carteiras de 40 ± 2 clientes por representante nas cidades das rotas, com os 26 âncoras como sempre', async () => {
    const clientes = await clientesDoSeed();
    expect(clientes.length).toBeGreaterThanOrEqual(26);
    expect(clientes).toHaveLength(CLIENTES_DA_DEMONSTRACAO);

    const daEduarda = clientes.filter((cliente) => cliente.representante.email === 'eduarda@chokolaten.com.br');
    const doRafael = clientes.filter((cliente) => cliente.representante.email === 'rafael@chokolaten.com.br');
    for (const carteira of [daEduarda, doRafael]) {
      expect(carteira.length).toBeGreaterThanOrEqual(38);
      expect(carteira.length).toBeLessThanOrEqual(42);
    }
    expect(daEduarda.every((cliente) => CIDADES_EDUARDA.includes(cliente.cidade))).toBe(true);
    expect(doRafael.every((cliente) => CIDADES_RAFAEL.includes(cliente.cidade))).toBe(true);

    // Os 26 âncoras: os mesmos nomes e o mesmo cadastro de antes
    expect(CLIENTES_ANCORA.map((cliente) => cliente.nomeFantasia).sort()).toEqual([...NOMES_DAS_ANCORAS].sort());
    for (const ancora of CLIENTES_ANCORA) {
      const salvo = clientes.find((cliente) => cliente.cnpj === ancora.cnpj);
      expect(salvo).toMatchObject({
        razaoSocial: ancora.razaoSocial,
        nomeFantasia: ancora.nomeFantasia,
        cidade: ancora.cidade,
        endereco: ancora.endereco,
        telefone: ancora.telefone,
        email: ancora.email,
        ativo: ancora.ativo ?? true,
      });
      expect(salvo?.representante.email).toBe(ancora.representanteEmail);
      expect(salvo?.contacts.map((contato) => contato.email).sort()).toEqual(
        ancora.contatos.map((contato) => contato.email).sort(),
      );
    }
    const indaial = clientes.find((cliente) => cliente.nomeFantasia === 'Padaria Confeitaria Indaial');
    expect(indaial?.cnpj).toBe('20952813000199');
  });

  it('todo cliente tem CNPJ válido e único, razão social diferente do nome fantasia, telefone de SC e e-mail único', async () => {
    const clientes = await clientesDoSeed();

    for (const cliente of clientes) {
      expect({
        nome: cliente.nomeFantasia,
        valido: cnpjValido(cliente.cnpj),
      }).toEqual({
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

  it('todo cliente tem 1 ou 2 contatos com cargo e exatamente um principal, sem nome de contato repetido', async () => {
    const clientes = await clientesDoSeed();
    const nomesDeContato = clientes.flatMap((cliente) => cliente.contacts.map((contato) => contato.nome));
    expect(nomesDeContato.filter((nome, indice) => nomesDeContato.indexOf(nome) !== indice)).toEqual([]);

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
    expect(comErp).toHaveLength(clientes.length - 2);
    for (const erpId of comErp) {
      expect(erpId).toMatch(/^\d{5}$/);
      expect(erpId).not.toMatch(/-0$/);
    }
    expect(new Set(comErp).size).toBe(comErp.length);
  });

  it('a calibração do ERP simulado dá 0 meses sem compra aos clientes em dia e 3 ou mais só ao Armazém São Bento', async () => {
    const meses = (nomeFantasia: string): number => {
      const erpId = ERP_IDS_DEMONSTRACAO[nomeFantasia];
      if (!erpId) throw new Error(`${nomeFantasia} sem erpId na calibração.`);
      return perfilDoErpId(erpId).mesesSemCompra;
    };

    expect(meses('Armazém São Bento')).toBeGreaterThanOrEqual(3);
    expect(meses('Empório Pomerode')).toBe(0);
    expect(meses('Empório do Vale Brusque')).toBe(0);
    expect(meses('Mercearia Alto Vale')).toBe(0);
    expect(meses('Panificadora Vila Lenzi')).toBe(0);

    const clientes = await clientesDoSeed();
    const comTresOuMais = clientes
      .filter((cliente) => cliente.erpId !== null && perfilDoErpId(cliente.erpId).mesesSemCompra >= 3)
      .map((cliente) => cliente.nomeFantasia);
    expect(comTresOuMais).toEqual(['Armazém São Bento']);
    // Os gerados (fora dos âncoras) compram em dia no ERP simulado
    const ancoras = new Set<string>(NOMES_DAS_ANCORAS);
    const gerados = clientes.filter((cliente) => !ancoras.has(cliente.nomeFantasia));
    expect(gerados.length).toBeGreaterThan(0);
    expect(
      gerados.every((cliente) => cliente.erpId !== null && perfilDoErpId(cliente.erpId).mesesSemCompra === 0),
    ).toBe(true);
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

/** Clientes cujo histórico foge da recorrência de propósito (dependem de `hoje` por definição). */
const PROPOSITO = {
  nuncaVisitado: 'Padaria Confeitaria Indaial',
  inativo: 'Café Beira-Rio',
  atrasados: ['Mercado Central Joinville', 'Doceria Jaraguá', 'Casa de Chás Itajaí'],
};

/** Dia da semana da data: 0 = domingo … 6 = sábado. */
function diaDaSemanaDe(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

/** Dias úteis (segunda a sexta) do mês da data. */
function diasUteisDoMes(data: string): number {
  const [ano, mes] = data.split('-').map(Number) as [number, number];
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  let uteis = 0;
  for (let d = 1; d <= total; d++) {
    const semana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
    if (semana !== 0 && semana !== 6) uteis += 1;
  }
  return uteis;
}

describe('histórico realista', () => {
  let agora: Date;

  beforeAll(async () => {
    await truncateAllTables();
    agora = new Date();
    await reiniciarDemonstracao(prisma, agora);
  });

  async function tokenDoGestor(): Promise<string> {
    const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
    return login.body.token;
  }

  it('cada dia útil das 13 semanas, antes de hoje, tem de 4 a 6 visitas por representante; nenhuma no fim de semana', async () => {
    const visitas = await prisma.visit.findMany({ include: { user: true } });
    const hoje = dataCalendario(agora);
    const contagem = new Map<string, number>();
    for (const visita of visitas) {
      const data = dataCalendario(visita.dataHora);
      expect([0, 6]).not.toContain(diaDaSemanaDe(data));
      const chave = `${visita.user.email}|${data}`;
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    const datas = [...new Set(visitas.map((visita) => dataCalendario(visita.dataHora)))].sort();
    const primeira = datas[0] as string;
    expect(diaDaSemanaDe(primeira)).toBe(1);
    expect(diasEntre(primeira, hoje)).toBeLessThan(91);
    for (let data = primeira; data < hoje; data = somarDias(data, 1)) {
      if ([0, 6].includes(diaDaSemanaDe(data))) continue;
      for (const email of ['eduarda@chokolaten.com.br', 'rafael@chokolaten.com.br']) {
        const quantidade = contagem.get(`${email}|${data}`) ?? 0;
        expect({ data, email, ok: quantidade >= 4 && quantidade <= 6 }).toEqual({ data, email, ok: true });
      }
    }
  });

  it('todo cliente ativo na rota tem visita, os intervalos batem com a recorrência (±3 dias) e ninguém é visitado duas vezes no dia', async () => {
    const clientes = await prisma.client.findMany({
      include: { visits: { orderBy: { dataHora: 'asc' } } },
    });

    for (const cliente of clientes) {
      expect([7, 14, 21, 28, 42]).toContain(cliente.recorrenciaDias);
      if (cliente.nomeFantasia === PROPOSITO.nuncaVisitado) {
        expect(cliente.visits).toHaveLength(0);
        continue;
      }
      expect({
        cliente: cliente.nomeFantasia,
        temVisita: cliente.visits.length > 0,
      }).toEqual({
        cliente: cliente.nomeFantasia,
        temVisita: true,
      });
      const dias = cliente.visits.map((visita) => dataCalendario(visita.dataHora));
      expect(new Set(dias).size).toBe(dias.length);
      for (let i = 1; i < dias.length; i++) {
        const intervalo = diasEntre(dias[i - 1] as string, dias[i] as string);
        expect({
          cliente: cliente.nomeFantasia,
          dentro: Math.abs(intervalo - cliente.recorrenciaDias) <= 3,
        }).toEqual({
          cliente: cliente.nomeFantasia,
          dentro: true,
        });
      }
    }
    expect(clientes.filter((cliente) => !cliente.ativo).map((cliente) => cliente.nomeFantasia)).toEqual([
      PROPOSITO.inativo,
    ]);
  });

  it('casos de propósito: inativo há 7 semanas, três atrasados (AMARELO, LARANJA e VERMELHO), Armazém em dia', async () => {
    const hoje = dataCalendario(agora);
    const diasDesdeAUltima = async (nomeFantasia: string): Promise<number> => {
      const cliente = await prisma.client.findFirstOrThrow({
        where: { nomeFantasia },
        include: { visits: { orderBy: { dataHora: 'desc' }, take: 1 } },
      });
      return diasEntre(dataCalendario((cliente.visits[0] as { dataHora: Date }).dataHora), hoje);
    };
    expect(await diasDesdeAUltima(PROPOSITO.inativo)).toBeGreaterThanOrEqual(49);
    const [umaPulada, doceria, tresPuladas] = PROPOSITO.atrasados as [string, string, string];
    expect(await diasDesdeAUltima(umaPulada)).toBeGreaterThan(7);
    // Doceria: última visita de 16 a 29 dias atrás (corte fixo), sempre LARANJA
    expect(await diasDesdeAUltima(doceria)).toBeGreaterThanOrEqual(16);
    expect(await diasDesdeAUltima(doceria)).toBeLessThanOrEqual(29);
    expect(await diasDesdeAUltima(tresPuladas)).toBeGreaterThan(42);
    expect(await diasDesdeAUltima('Armazém São Bento')).toBeLessThanOrEqual(15);
  });

  it('pedidos têm de 1 a 4 itens só nas visitas de venda; resultados perto de 55/25/20 %', async () => {
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
    const tamanhos = new Set(
      visitas.filter((visita) => visita.resultado === 'VENDA').map((visita) => visita.itens.length),
    );
    expect(tamanhos.size).toBeGreaterThanOrEqual(3);
    const fracao = (resultado: string): number =>
      visitas.filter((visita) => visita.resultado === resultado).length / visitas.length;
    expect(fracao('VENDA')).toBeGreaterThan(0.45);
    expect(fracao('VENDA')).toBeLessThan(0.67);
    expect(fracao('NEGOCIACAO')).toBeGreaterThan(0.15);
    expect(fracao('SEM_VENDA')).toBeGreaterThan(0.1);
  });

  it('a demonstração de hoje mostra as quatro cores e um cliente rebaixado pelo ERP', async () => {
    const res = await request(app)
      .get('/clients')
      .set('Authorization', `Bearer ${await tokenDoGestor()}`);

    expect(res.status).toBe(200);
    const clientes = res.body.data as {
      nomeFantasia: string;
      cor: string;
      rebaixadoPorVenda: boolean;
    }[];
    expect(new Set(clientes.map((cliente) => cliente.cor))).toEqual(
      new Set(['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO']),
    );
    // Os três atrasados em três cores distintas
    const corDe = (nome: string): string | undefined => clientes.find((cliente) => cliente.nomeFantasia === nome)?.cor;
    expect(PROPOSITO.atrasados.map(corDe)).toEqual(['AMARELO', 'LARANJA', 'VERMELHO']);
    expect(clientes.filter((cliente) => cliente.rebaixadoPorVenda).map((cliente) => cliente.nomeFantasia)).toEqual([
      'Armazém São Bento',
    ]);
  });

  it('cada cliente aparece uma vez só na agenda do dia', async () => {
    const res = await request(app)
      .get('/agenda/today')
      .set('Authorization', `Bearer ${await tokenDoGestor()}`);

    expect(res.status).toBe(200);
    const secoes = [...res.body.data.atrasadas, ...res.body.data.hoje, ...res.body.data.proximos7Dias] as {
      nomeFantasia: string;
    }[];
    const nomes = secoes.map((item) => item.nomeFantasia);
    expect(nomes.length).toBeGreaterThan(0);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it('anotações citam o contato da visita e não se repetem em sequência no mesmo cliente', async () => {
    const clientes = await prisma.client.findMany({
      include: {
        visits: { orderBy: { dataHora: 'asc' }, include: { contact: true } },
      },
    });
    for (const cliente of clientes) {
      for (const [indice, visita] of cliente.visits.entries()) {
        expect(visita.contact).not.toBeNull();
        expect(visita.descricao).toContain((visita.contact?.nome ?? '').split(' ')[0] as string);
        if (indice > 0) expect(visita.descricao).not.toBe(cliente.visits[indice - 1]?.descricao);
      }
    }
  });

  it('campanhas do mês e do seguinte, visitas de campanha com produto dela, três próximas visitas e quatro lembretes', async () => {
    const hoje = dataCalendario(agora);
    const campanhas = await prisma.campaign.findMany({
      orderBy: { inicio: 'asc' },
    });
    expect(campanhas).toHaveLength(2);
    const [atual, seguinte] = campanhas as [(typeof campanhas)[number], (typeof campanhas)[number]];
    expect(dia(atual.inicio) <= hoje && hoje <= dia(atual.fim)).toBe(true);
    expect(dia(atual.inicio).slice(0, 7)).toBe(hoje.slice(0, 7));
    expect(dia(seguinte.inicio)).toBe(somarDias(dia(atual.fim), 1));
    expect(atual.nome).toMatch(/ \d{4}$/);

    const emCampanha = await prisma.visit.findMany({
      where: { campanhaId: { not: null } },
      include: { itens: true },
    });
    for (const visita of emCampanha) {
      expect(visita.campanhaId).toBe(atual.id);
      expect(visita.resultado).toBe('VENDA');
      expect(dataCalendario(visita.dataHora) >= dia(atual.inicio)).toBe(true);
      expect(visita.itens.some((item) => atual.produtos.includes(item.sku))).toBe(true);
    }

    const comProxima = await prisma.client.findMany({
      where: { proximaVisita: { not: null } },
    });
    expect(comProxima.map((cliente) => cliente.email).sort()).toEqual([
      'contato@cafeblumenau.com.br',
      'contato@doceriajaragua.com.br',
      'contato@emporiodovalebrusque.com.br',
    ]);
    const doceria = comProxima.find((cliente) => cliente.email === 'contato@doceriajaragua.com.br');
    expect(dia(doceria?.proximaVisita as Date)).toBe(somarDias(hoje, -2));

    const lembretes = await prisma.reminder.findMany({
      include: { client: true },
    });
    expect(lembretes).toHaveLength(4);
    expect(lembretes.filter((lembrete) => lembrete.concluidoEm !== null)).toHaveLength(1);
    const vencidos = lembretes.filter(
      (lembrete) => lembrete.concluidoEm === null && dia(lembrete.data) === somarDias(hoje, -3),
    );
    expect(vencidos).toHaveLength(1);

    // O cliente inativo guarda o histórico, mas não tem próxima visita nem lembrete
    const inativo = await prisma.client.findFirstOrThrow({
      where: { ativo: false },
      include: { visits: true },
    });
    expect(inativo.visits.length).toBeGreaterThan(0);
    expect(comProxima.some((cliente) => cliente.id === inativo.id)).toBe(false);
    expect(lembretes.some((lembrete) => lembrete.clientId === inativo.id)).toBe(false);
  });

  it('metas mensais compatíveis com o ritmo gerado: vendas ≈ 1,1 × a média mensal e visitas = dias úteis × 5', async () => {
    const hoje = dataCalendario(agora);
    const maisAntiga = await prisma.visit.findFirstOrThrow({
      orderBy: { dataHora: 'asc' },
    });
    const dias = diasEntre(dataCalendario(maisAntiga.dataHora), hoje) + 1;
    const metas = await prisma.goal.findMany({ where: { periodo: 'MENSAL' } });
    expect(metas).toHaveLength(2);
    for (const meta of metas) {
      const itens = await prisma.visitItem.findMany({
        where: { visit: { userId: meta.representanteId, resultado: 'VENDA' } },
      });
      const total = itens.reduce((soma, item) => soma + item.quantidade * item.precoUnitario.toNumber(), 0);
      const razao = meta.metaVendas.toNumber() / ((total / dias) * 30);
      expect(razao).toBeGreaterThan(1.0);
      expect(razao).toBeLessThan(1.2);
      expect(meta.metaVisitas).toBe(diasUteisDoMes(hoje) * 5);
    }
  });

  it('nenhuma visita no futuro e todas em horário comercial de São Paulo, com horários variados', async () => {
    const visitas = await prisma.visit.findMany();
    expect(visitas.every((visita) => visita.dataHora <= agora)).toBe(true);
    const horarios = visitas.map((visita) => horario(visita.dataHora));
    expect(horarios.every((valor) => valor >= '08:00' && valor <= '17:00')).toBe(true);
    expect(new Set(horarios).size).toBeGreaterThanOrEqual(20);
  });

  it('nenhuma descrição de visita ou texto de lembrete tem marca de demonstração', async () => {
    const marca = /ERP-|exemplo|teste|demo|cliente \d/i;
    const visitas = await prisma.visit.findMany();
    const lembretes = await prisma.reminder.findMany();

    for (const texto of [
      ...visitas.map((visita) => visita.descricao),
      ...lembretes.map((lembrete) => lembrete.texto),
    ]) {
      expect(texto).not.toMatch(marca);
    }
  });
});
