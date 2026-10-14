import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
// erpIds calibrados para a demonstração da Etapa 5 (cor composta com
// rebaixamento por última compra no ERP) — ver comentário de calibração
// em src/config/erpIdsDemonstracao.ts.
import { ERP_IDS_DEMONSTRACAO } from '../src/config/erpIdsDemonstracao';
import { eventosSazonaisParaSeed } from '../src/config/eventosSazonaisSeed';
import { upsertMany } from '../src/repositories/seasonal-event.repository';

const SENHA_PADRAO = 'chokocrm123';
const CUSTO_HASH = 10;

type ContatoSeed = {
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

type ClienteSeed = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  contatos: ContatoSeed[];
  erpId?: string | null;
  /** Dono da carteira; os nove primeiros clientes são da Eduarda, os quatro últimos do Rafael. */
  representanteEmail: string;
};

const EMAIL_EDUARDA = 'eduarda@chokolaten.com.br';
const EMAIL_RAFAEL = 'rafael@chokolaten.com.br';
const EMAIL_GESTOR = 'gestor@chokolaten.com.br';

const CLIENTES: ClienteSeed[] = [
  {
    razaoSocial: 'Empório Pomerode Comércio de Alimentos Ltda',
    nomeFantasia: 'Empório Pomerode',
    cnpj: '11222333000181',
    cidade: 'Pomerode',
    endereco: 'Rua Hermann Weege, 620 - Centro, Pomerode/SC',
    telefone: '(47) 3395-1122',
    email: 'contato@emporiopomerode.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Marta Weber',
        cargo: 'Compradora',
        telefone: '(47) 99911-2233',
        email: 'marta.weber@emporiopomerode.com.br',
        principal: true,
      },
      {
        nome: 'João Siewert',
        cargo: 'Proprietário',
        telefone: '(47) 99922-3344',
        email: 'joao.siewert@emporiopomerode.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Café Blumenau Comércio de Alimentos Ltda',
    nomeFantasia: 'Café Blumenau',
    cnpj: '11222333000262',
    cidade: 'Blumenau',
    endereco: 'Rua XV de Novembro, 500 - Centro, Blumenau/SC',
    telefone: '(47) 3322-1010',
    email: 'contato@cafeblumenau.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Helena Krüger',
        cargo: 'Gerente',
        telefone: '(47) 99933-1010',
        email: 'helena.kruger@cafeblumenau.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Doceria Jaraguá Doces e Salgados Ltda',
    nomeFantasia: 'Doceria Jaraguá',
    cnpj: '11222333000343',
    cidade: 'Jaraguá do Sul',
    endereco: 'Rua Reinoldo Rau, 220 - Centro, Jaraguá do Sul/SC',
    telefone: '(47) 3275-2020',
    email: 'contato@doceriajaragua.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Cristiane Bauer',
        cargo: 'Proprietária',
        telefone: '(47) 99944-2020',
        email: 'cristiane.bauer@doceriajaragua.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Mercado Central Joinville Comércio de Alimentos Ltda',
    nomeFantasia: 'Mercado Central Joinville',
    cnpj: '11222333000424',
    cidade: 'Joinville',
    endereco: 'Rua do Príncipe, 800 - Centro, Joinville/SC',
    telefone: '(47) 3433-3030',
    email: 'contato@mercadocentraljoinville.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Roberto Alves',
        cargo: 'Gerente de Compras',
        telefone: '(47) 99955-3030',
        email: 'roberto.alves@mercadocentraljoinville.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Padaria Vale Europeu Ltda',
    nomeFantasia: 'Padaria Vale Europeu',
    cnpj: '11222333000505',
    cidade: 'Timbó',
    endereco: 'Rua 7 de Setembro, 150 - Centro, Timbó/SC',
    telefone: '(47) 3382-4040',
    email: 'contato@padariavaleeuropeu.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Sandra Zimmermann',
        cargo: 'Proprietária',
        telefone: '(47) 99966-4040',
        email: 'sandra.zimmermann@padariavaleeuropeu.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Cafeteria Estrada Bonita Ltda',
    nomeFantasia: 'Cafeteria Estrada Bonita',
    cnpj: '11222333000686',
    cidade: 'Joinville',
    endereco: 'Estrada Bonita, 1200 - Vila Nova, Joinville/SC',
    telefone: '(47) 3455-5050',
    email: 'contato@cafeteriaestradabonita.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Fernanda Souza',
        cargo: 'Gerente',
        telefone: '(47) 99977-5050',
        email: 'fernanda.souza@cafeteriaestradabonita.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Empório do Chocolate Comércio Ltda',
    nomeFantasia: 'Empório do Chocolate',
    cnpj: '11222333000767',
    cidade: 'Blumenau',
    endereco: 'Rua Sete de Setembro, 300 - Centro, Blumenau/SC',
    telefone: '(47) 3311-6060',
    email: 'contato@emporiodochocolate.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Patrícia Hoffmann',
        cargo: 'Compradora',
        telefone: '(47) 99988-6060',
        email: 'patricia.hoffmann@emporiodochocolate.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Confeitaria Rota das Cachoeiras Ltda',
    nomeFantasia: 'Confeitaria Rota das Cachoeiras',
    cnpj: '11222333000848',
    cidade: 'Corupá',
    endereco: 'Rua Getúlio Vargas, 450 - Centro, Corupá/SC',
    telefone: '(47) 3375-7070',
    email: 'contato@rotadascachoeiras.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Marcelo Piske',
        cargo: 'Proprietário',
        telefone: '(47) 99999-7070',
        email: 'marcelo.piske@rotadascachoeiras.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Armazém São Bento Comércio Ltda',
    nomeFantasia: 'Armazém São Bento',
    cnpj: '11222333000929',
    cidade: 'São Bento do Sul',
    endereco: 'Rua XV de Novembro, 900 - Centro, São Bento do Sul/SC',
    telefone: '(47) 3633-8080',
    email: 'contato@armazemsaobento.com.br',
    representanteEmail: EMAIL_EDUARDA,
    contatos: [
      {
        nome: 'Luciane Wolf',
        cargo: 'Gerente',
        telefone: '(47) 99900-8080',
        email: 'luciane.wolf@armazemsaobento.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Empório do Vale Brusque Comércio de Alimentos Ltda',
    nomeFantasia: 'Empório do Vale Brusque',
    cnpj: '23456780000184',
    cidade: 'Brusque',
    endereco: 'Rua Dr. Maruri, 410 - Centro, Brusque/SC',
    telefone: '(47) 3351-1212',
    email: 'contato@emporiodovalebrusque.com.br',
    representanteEmail: EMAIL_RAFAEL,
    contatos: [
      {
        nome: 'Aline Becker',
        cargo: 'Compradora',
        telefone: '(47) 99811-1212',
        email: 'aline.becker@emporiodovalebrusque.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Casa de Chás e Doces Itajaí Ltda',
    nomeFantasia: 'Casa de Chás Itajaí',
    cnpj: '23456781000129',
    cidade: 'Itajaí',
    endereco: 'Rua Hercílio Luz, 735 - Centro, Itajaí/SC',
    telefone: '(47) 3344-2323',
    email: 'contato@casadechasitajai.com.br',
    representanteEmail: EMAIL_RAFAEL,
    contatos: [
      {
        nome: 'Gustavo Pereira',
        cargo: 'Proprietário',
        telefone: '(47) 99822-2323',
        email: 'gustavo.pereira@casadechasitajai.com.br',
        principal: true,
      },
      {
        nome: 'Camila Rocha',
        cargo: 'Gerente',
        telefone: '(47) 99833-2324',
        email: 'camila.rocha@casadechasitajai.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Mercearia Alto Vale Rio do Sul Ltda',
    nomeFantasia: 'Mercearia Alto Vale',
    cnpj: '23456782000173',
    cidade: 'Rio do Sul',
    endereco: 'Rua Quinze de Novembro, 1.150 - Centro, Rio do Sul/SC',
    telefone: '(47) 3521-3434',
    email: 'contato@merceariaaltovale.com.br',
    representanteEmail: EMAIL_RAFAEL,
    contatos: [
      {
        nome: 'Débora Lenzi',
        cargo: 'Gerente de Compras',
        telefone: '(47) 99844-3434',
        email: 'debora.lenzi@merceariaaltovale.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Padaria e Confeitaria Indaial Ltda',
    nomeFantasia: 'Padaria Confeitaria Indaial',
    cnpj: '23456783000118',
    cidade: 'Indaial',
    endereco: 'Rua Presidente Castelo Branco, 280 - Centro, Indaial/SC',
    telefone: '(47) 3333-4545',
    email: 'contato@padariaconfeitariaindaial.com.br',
    representanteEmail: EMAIL_RAFAEL,
    contatos: [
      {
        nome: 'Tiago Dalfovo',
        cargo: 'Proprietário',
        telefone: '(47) 99855-4545',
        email: 'tiago.dalfovo@padariaconfeitariaindaial.com.br',
        principal: true,
      },
    ],
  },
];

async function seedUsuarios(): Promise<void> {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, CUSTO_HASH);

  const usuarios = [
    { nome: 'Eduarda Fischer', email: EMAIL_EDUARDA, role: 'REPRESENTANTE' as const },
    { nome: 'Rafael Schmitt', email: EMAIL_RAFAEL, role: 'REPRESENTANTE' as const },
    { nome: 'Maicon Krüger', email: EMAIL_GESTOR, role: 'GESTOR' as const },
  ];

  for (const { nome, email, role } of usuarios) {
    await prisma.user.upsert({
      where: { email },
      update: { nome, senhaHash, role },
      create: { nome, email, senhaHash, role },
    });
  }
}

async function seedContato(clientId: string, contato: ContatoSeed): Promise<void> {
  const existente = await prisma.contact.findFirst({
    where: { clientId, email: contato.email },
  });

  if (existente) {
    await prisma.contact.update({ where: { id: existente.id }, data: contato });
    return;
  }

  await prisma.contact.create({ data: { ...contato, clientId } });
}

async function seedCliente(cliente: ClienteSeed): Promise<void> {
  const { contatos, representanteEmail, ...dadosCliente } = cliente;
  const { id: representanteId } = await prisma.user.findUniqueOrThrow({
    where: { email: representanteEmail },
  });
  const erpId = ERP_IDS_DEMONSTRACAO[cliente.nomeFantasia] ?? null;

  const client = await prisma.client.upsert({
    where: { cnpj: cliente.cnpj },
    update: { ...dadosCliente, representanteId, erpId },
    create: { ...dadosCliente, representanteId, erpId },
  });

  for (const contato of contatos) {
    await seedContato(client.id, contato);
  }
}

type VisitaSeed = {
  diasAtras: number;
  descricao: string;
  resultado: 'VENDA' | 'NEGOCIACAO' | 'SEM_VENDA';
};

type VisitasClienteSeed = {
  emailCliente: string;
  visitas: VisitaSeed[];
};

/**
 * Visitas de demonstração por cliente, para a timeline da ficha ter
 * conteúdo e, com as regras da Etapa 4 (cor pela última visita; agenda =
 * última visita + recorrência, ou criadoEm + recorrência sem visita),
 * o banco de dev nascer mostrando as quatro cores e uma agenda do dia
 * não vazia (atrasadas e hoje):
 * - Empório Pomerode: VERDE (VENDA há 3 dias) — histórico original mantido.
 * - Café Blumenau: AMARELO (NEGOCIACAO há 10 dias, dentro dos 15 dias).
 * - Doceria Jaraguá: LARANJA e atrasada (SEM_VENDA há 20 dias; próxima
 *   visita vencida há 5 dias, pois a recorrência padrão é 15 dias).
 * - Mercado Central Joinville: VERMELHO e mais atrasada ainda (VENDA há
 *   40 dias; próxima visita vencida há 25 dias).
 * - Armazém São Bento: VERDE (VENDA há 15 dias) mas cai em "Hoje" na
 *   agenda, pois a próxima visita (15 + recorrência de 15 dias) é hoje.
 * - Carteira do Rafael (2 visitas nos últimos 30 dias, nenhuma com VENDA,
 *   então a conversão dele é 0 %, abaixo dos 40 % da Eduarda):
 *   - Empório do Vale Brusque: AMARELO (NEGOCIACAO há 6 dias; ERP com
 *     compra recente, sem rebaixamento).
 *   - Casa de Chás Itajaí: LARANJA (SEM_VENDA há 20 dias).
 *   - Mercearia Alto Vale e Padaria Confeitaria Indaial: sem visita, logo
 *     VERMELHO.
 * Os demais clientes do seed permanecem sem visita (VERMELHO, agenda
 * futura), o que também é um estado válido de demonstração. O usuário de
 * cada visita é o dono da carteira do cliente.
 *
 * Idempotente por cliente: se o cliente já tem visita registrada, pula
 * (não duplica) — mesmo comportamento de antes, agora aplicado a cada
 * cliente da lista, não só ao primeiro.
 */
const VISITAS_DEMO: VisitasClienteSeed[] = [
  {
    emailCliente: 'contato@emporiopomerode.com.br',
    visitas: [
      {
        diasAtras: 3,
        descricao: 'Reposição do mostruário e pedido de trufas para o fim de semana.',
        resultado: 'VENDA',
      },
      {
        diasAtras: 20,
        descricao: 'Apresentei a linha de Páscoa; pediu proposta por escrito.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 45,
        descricao: 'Visita de relacionamento; estoque ainda alto, sem pedido.',
        resultado: 'SEM_VENDA',
      },
    ],
  },
  {
    emailCliente: 'contato@cafeblumenau.com.br',
    visitas: [
      {
        diasAtras: 10,
        descricao: 'Apresentação da linha de inverno; pediu tabela de preços.',
        resultado: 'NEGOCIACAO',
      },
    ],
  },
  {
    emailCliente: 'contato@doceriajaragua.com.br',
    visitas: [
      {
        diasAtras: 20,
        descricao: 'Visita de acompanhamento; prateleira ainda cheia, não fechou pedido.',
        resultado: 'SEM_VENDA',
      },
    ],
  },
  {
    emailCliente: 'contato@mercadocentraljoinville.com.br',
    visitas: [
      {
        diasAtras: 40,
        descricao: 'Reposição de gôndola e fechamento do pedido do mês.',
        resultado: 'VENDA',
      },
    ],
  },
  {
    emailCliente: 'contato@armazemsaobento.com.br',
    visitas: [
      {
        diasAtras: 15,
        descricao: 'Pedido de reposição da linha tradicional para o mês.',
        resultado: 'VENDA',
      },
    ],
  },
  {
    emailCliente: 'contato@emporiodovalebrusque.com.br',
    visitas: [
      {
        diasAtras: 6,
        descricao: 'Apresentei as caixas de Natal; vão avaliar o pedido com a sócia.',
        resultado: 'NEGOCIACAO',
      },
    ],
  },
  {
    emailCliente: 'contato@casadechasitajai.com.br',
    visitas: [
      {
        diasAtras: 20,
        descricao: 'Primeira visita; estoque da vitrine ainda cheio, sem pedido.',
        resultado: 'SEM_VENDA',
      },
    ],
  },
];

async function seedVisitas(): Promise<void> {
  const agora = Date.now();
  const diasAtras = (dias: number): Date => new Date(agora - dias * 24 * 60 * 60 * 1000);

  for (const { emailCliente, visitas } of VISITAS_DEMO) {
    const cliente = await prisma.client.findFirst({
      where: { email: emailCliente },
      include: { contacts: { where: { principal: true } } },
    });
    if (!cliente) continue;

    const jaTemVisitas = await prisma.visit.count({ where: { clientId: cliente.id } });
    if (jaTemVisitas > 0) continue;

    const [contatoPrincipal] = cliente.contacts;

    await prisma.visit.createMany({
      data: visitas.map((visita) => ({
        clientId: cliente.id,
        userId: cliente.representanteId,
        contactId: contatoPrincipal?.id ?? null,
        dataHora: diasAtras(visita.diasAtras),
        descricao: visita.descricao,
        resultado: visita.resultado,
      })),
    });
  }
}

/** Calendário sazonal (Etapa 6A) do ano corrente e do seguinte; idempotente por `nome` (upsert). */
async function seedEventosSazonais(): Promise<void> {
  const ano = new Date().getFullYear();
  await upsertMany(eventosSazonaisParaSeed([ano, ano + 1]));
}

async function main(): Promise<void> {
  await seedUsuarios();

  for (const cliente of CLIENTES) {
    await seedCliente(cliente);
  }

  await seedEventosSazonais();
  await seedVisitas();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
