import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

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
};

const CLIENTES: ClienteSeed[] = [
  {
    razaoSocial: 'Empório Pomerode Comércio de Alimentos Ltda',
    nomeFantasia: 'Empório Pomerode',
    cnpj: '11222333000181',
    cidade: 'Pomerode',
    endereco: 'Rua Hermann Weege, 620 - Centro, Pomerode/SC',
    telefone: '(47) 3395-1122',
    email: 'contato@emporiopomerode.com.br',
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
];

async function seedUsuarios(): Promise<void> {
  const senhaHash = await bcrypt.hash(SENHA_PADRAO, CUSTO_HASH);

  await prisma.user.upsert({
    where: { email: 'eduarda@chokolaten.com.br' },
    update: { nome: 'Eduarda Fischer', senhaHash, role: 'REPRESENTANTE' },
    create: {
      nome: 'Eduarda Fischer',
      email: 'eduarda@chokolaten.com.br',
      senhaHash,
      role: 'REPRESENTANTE',
    },
  });

  await prisma.user.upsert({
    where: { email: 'gestor@chokolaten.com.br' },
    update: { nome: 'Ricardo Menezes', senhaHash, role: 'GESTOR' },
    create: {
      nome: 'Ricardo Menezes',
      email: 'gestor@chokolaten.com.br',
      senhaHash,
      role: 'GESTOR',
    },
  });
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
  const { contatos, ...dadosCliente } = cliente;

  const client = await prisma.client.upsert({
    where: { cnpj: cliente.cnpj },
    update: dadosCliente,
    create: dadosCliente,
  });

  for (const contato of contatos) {
    await seedContato(client.id, contato);
  }
}

async function main(): Promise<void> {
  await seedUsuarios();

  for (const cliente of CLIENTES) {
    await seedCliente(cliente);
  }
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
