import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient, ResultadoVisita, TipoCampanha } from '@prisma/client';
// erpIds calibrados para a demonstração da Etapa 5 (cor composta com
// rebaixamento por última compra no ERP) — ver comentário de calibração
// em config/erpIdsDemonstracao.ts.
import { ERP_IDS_DEMONSTRACAO } from '../config/erpIdsDemonstracao';
import { eventosSazonaisParaSeed } from '../config/eventosSazonaisSeed';
import {
  colunaDateDaData,
  dataCalendario,
  somarDias,
  type DataCalendario,
} from '../services/classificacao.service';
import { buscarProduto } from '../services/erp.service';
import { periodoDaMeta } from '../services/goal.regras';

/**
 * Dados de demonstração do ChokoCRM (spec da Etapa 8, seção 9), usados por
 * `prisma/seed.ts`: `semear` só acrescenta (`npm run db:seed`) e
 * `reiniciarDemonstracao` apaga e recria (`npm run db:seed:reset`). Fica em
 * `src/` (não em `prisma/`) porque `tsconfig.json` só inclui `src` e
 * `tests`, e `tests/seed.test.ts` chama as duas funções direto, como
 * `config/eventosSazonaisSeed.ts`. Todas as datas são relativas ao `hoje`
 * recebido, para a demonstração nascer com cores, agenda, campanhas e metas
 * do dia em que roda.
 */

/** Senha das três contas de demonstração (publicada no guia de desenvolvimento). */
export const SENHA_DEMONSTRACAO = 'chokocrm123';
const CUSTO_HASH = 10;
const MILISSEGUNDOS_POR_DIA = 86_400_000;

/** O cliente do Prisma ou o de uma transação interativa: o seed roda nos dois. */
type Banco = PrismaClient | Prisma.TransactionClient;

/**
 * Prazo da transação do reinício: o padrão do Prisma (5 s) não cobre o hash
 * das senhas e as ~150 gravações do seed num banco remoto.
 */
const PRAZO_DA_TRANSACAO_MS = 120_000;

export type ModoDoSeed = 'semear' | 'reiniciar' | 'recusar';

/** Aviso de `--reset` em produção sem `--confirmar` (o processo sai com código 1). */
export const AVISO_RESET_EM_PRODUCAO = [
  'Reinício da demonstração recusado: NODE_ENV=production.',
  'O --reset apaga TODOS os clientes, contatos, visitas, pedidos, mensagens de estoque, campanhas e metas,',
  'inclusive os registrados pelos representantes de verdade (por exemplo, na validação); só as contas ficam.',
  'Para confirmar, rode de novo com --confirmar:  npm run db:seed:reset -- --confirmar',
].join('\n');

/**
 * O que `prisma/seed.ts` faz com os argumentos: sem `--reset`, só acrescenta;
 * com `--reset`, reinicia — em produção, só com `--confirmar` também, para o
 * comando destrutivo não rodar por engano (ruling R32).
 */
export function modoDoSeed(argumentos: readonly string[], ambiente: string): ModoDoSeed {
  if (!argumentos.includes('--reset')) return 'semear';
  if (ambiente === 'production' && !argumentos.includes('--confirmar')) return 'recusar';
  return 'reiniciar';
}

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

const USUARIOS_DEMO = [
  { nome: 'Eduarda Fischer', email: EMAIL_EDUARDA, role: 'REPRESENTANTE' as const, telefone: '(47) 99101-2030' },
  { nome: 'Rafael Schmitt', email: EMAIL_RAFAEL, role: 'REPRESENTANTE' as const, telefone: '(47) 99202-3040' },
  { nome: 'Maicon Krüger', email: EMAIL_GESTOR, role: 'GESTOR' as const, telefone: '(47) 99303-4050' },
];

/** Campanhas do protótipo adaptadas; o `semear` as reconhece pelo nome. */
const NOME_FEIRA = 'Feira Sabores do Vale — Blumenau';
const NOME_BLACK_FRIDAY = 'Black Friday do Cacau';

function nomeDoNatal(hoje: DataCalendario): string {
  return `Natal Chokolaten ${hoje.slice(0, 4)}`;
}

type CampanhaSeed = {
  nome: string;
  tipo: TipoCampanha;
  inicio: DataCalendario;
  fim: DataCalendario;
  descricao: string;
  desconto: number | null;
  produtos: string[];
};

/** Sexta-feira da Black Friday: a quarta sexta-feira de novembro. */
function blackFriday(ano: number): DataCalendario {
  const diaDaSemanaDoDia1 = new Date(Date.UTC(ano, 10, 1)).getUTCDay();
  const primeiraSexta = 1 + ((5 - diaDaSemanaDoDia1 + 7) % 7);
  return `${ano}-11-${String(primeiraSexta + 21).padStart(2, '0')}`;
}

/**
 * - Natal Chokolaten {ano}: de hoje + 15 a 24/12 (programada). Rodado depois
 *   de 09/12, começa em 24/12, para o fim nunca ficar antes do início.
 * - Black Friday do Cacau: a última semana de novembro, de segunda a domingo
 *   da semana da Black Friday (23 a 29/11 em 2026, como no protótipo).
 * - Feira Sabores do Vale — Blumenau: de ontem a amanhã (em andamento).
 * Produtos são SKUs do catálogo do ERP simulado.
 */
function campanhasDemo(hoje: DataCalendario): CampanhaSeed[] {
  const ano = Number(hoje.slice(0, 4));
  const fimDoNatal = `${ano}-12-24`;
  const daquiA15Dias = somarDias(hoje, 15);
  const sextaDaBlackFriday = blackFriday(ano);

  return [
    {
      nome: nomeDoNatal(hoje),
      tipo: 'CAMPANHA',
      inicio: daquiA15Dias < fimDoNatal ? daquiA15Dias : fimDoNatal,
      fim: fimDoNatal,
      descricao: 'Caixas presente e bombons sortidos com vitrine temática. Antecipar os pedidos até 30/11.',
      desconto: 8,
      produtos: ['CX-PRESENTE', 'BOMB-SORT', 'TRUF-70'],
    },
    {
      nome: NOME_BLACK_FRIDAY,
      tipo: 'PROMOCAO',
      inicio: somarDias(sextaDaBlackFriday, -4),
      fim: somarDias(sextaDaBlackFriday, 2),
      descricao: 'Barras e tabletes com preço especial para pedidos acima de 50 unidades.',
      desconto: 15,
      produtos: ['BARRA-70', 'TAB-LEITE'],
    },
    {
      nome: NOME_FEIRA,
      tipo: 'EVENTO',
      inicio: somarDias(hoje, -1),
      fim: somarDias(hoje, 1),
      descricao: 'Estande da Chokolaten na feira regional. Convidar os clientes de Blumenau e região.',
      desconto: null,
      produtos: ['PAO-MEL', 'TRUF-70', 'DRAGEE'],
    },
  ];
}

type ItemSeed = { sku: string; quantidade: number };

/** `NATAL` é a campanha de Natal do ano de hoje (o nome muda com o ano). */
type CampanhaDaVisita = 'NATAL' | typeof NOME_FEIRA;

type VisitaSeed = {
  diasAtras: number;
  descricao: string;
  resultado: ResultadoVisita;
  /** Pedido de 2 itens do catálogo, em toda visita com VENDA. */
  itens?: ItemSeed[];
  campanha?: CampanhaDaVisita;
};

type VisitasClienteSeed = {
  emailCliente: string;
  visitas: VisitaSeed[];
};

/**
 * Visitas de demonstração por cliente, para a timeline da ficha ter
 * conteúdo e, com as regras da Etapa 4 (cor pela última visita; agenda =
 * próxima visita marcada, ou última visita + recorrência, ou criadoEm +
 * recorrência sem visita), a demonstração nascer mostrando as quatro cores
 * e uma agenda do dia não vazia (atrasadas e hoje):
 * - Empório Pomerode: VERDE (VENDA há 3 dias, vinculada ao Natal) —
 *   histórico original mantido.
 * - Café Blumenau: AMARELO (NEGOCIACAO há 10 dias, dentro dos 15 dias).
 * - Doceria Jaraguá: LARANJA e atrasada (SEM_VENDA há 20 dias; próxima
 *   visita vencida há 5 dias, pois a recorrência padrão é 15 dias).
 * - Mercado Central Joinville: VERMELHO e mais atrasada ainda (VENDA há
 *   40 dias; próxima visita vencida há 25 dias).
 * - Armazém São Bento: VERDE pela visita (VENDA há 15 dias), rebaixado para
 *   LARANJA pelo ERP, e cai em "Hoje" na agenda (15 + recorrência de 15).
 * - Empório do Chocolate: VERDE (VENDA ontem, no primeiro dia da Feira
 *   Sabores do Vale, com a visita vinculada à feira).
 * - Carteira do Rafael (2 visitas nos últimos 30 dias, nenhuma com VENDA,
 *   então a conversão dele é 0 %, abaixo dos 50 % da Eduarda):
 *   - Empório do Vale Brusque: AMARELO (NEGOCIACAO há 6 dias, vinculada ao
 *     Natal; ERP com compra recente, sem rebaixamento).
 *   - Casa de Chás Itajaí: LARANJA (SEM_VENDA há 20 dias).
 *   - Mercearia Alto Vale e Padaria Confeitaria Indaial: sem visita, logo
 *     VERMELHO.
 * Os demais clientes do seed permanecem sem visita (VERMELHO, agenda
 * futura), o que também é um estado válido de demonstração. O usuário de
 * cada visita é o dono da carteira do cliente; os preços dos itens são os do
 * catálogo do ERP simulado.
 */
const VISITAS_DEMO: VisitasClienteSeed[] = [
  {
    emailCliente: 'contato@emporiopomerode.com.br',
    visitas: [
      {
        diasAtras: 3,
        descricao: 'Reposição do mostruário e primeiro pedido das caixas de Natal.',
        resultado: 'VENDA',
        itens: [
          { sku: 'CX-PRESENTE', quantidade: 12 },
          { sku: 'BOMB-SORT', quantidade: 10 },
        ],
        campanha: 'NATAL',
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
        itens: [
          { sku: 'BARRA-70', quantidade: 30 },
          { sku: 'TAB-LEITE', quantidade: 60 },
        ],
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
        itens: [
          { sku: 'TRUF-70', quantidade: 15 },
          { sku: 'BARRA-70', quantidade: 20 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@emporiodochocolate.com.br',
    visitas: [
      {
        diasAtras: 1,
        descricao: 'Visita no estande da feira; pedido de pães de mel e trufas para a vitrine.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 24 },
          { sku: 'TRUF-70', quantidade: 10 },
        ],
        campanha: NOME_FEIRA,
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
        campanha: 'NATAL',
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

type ProximaVisitaSeed = {
  emailCliente: string;
  diasAFrente: number;
  lembrete: string;
  campanha?: CampanhaDaVisita;
};

/**
 * Próxima visita marcada no check-in, com lembrete, em três clientes (todas
 * em "Próximos 7 dias" na agenda, uma vinculada ao Natal). Nenhuma muda a
 * cor nem tira cliente de "Atrasadas" ou "Hoje".
 */
const PROXIMAS_VISITAS_DEMO: ProximaVisitaSeed[] = [
  {
    emailCliente: 'contato@cafeblumenau.com.br',
    diasAFrente: 2,
    lembrete: 'Levar a tabela de preços da linha de inverno.',
  },
  {
    emailCliente: 'contato@emporiodovalebrusque.com.br',
    diasAFrente: 3,
    lembrete: 'Fechar o pedido das caixas de Natal com a sócia.',
    campanha: 'NATAL',
  },
  {
    emailCliente: 'contato@emporiodochocolate.com.br',
    diasAFrente: 6,
    lembrete: 'Conferir o giro dos pães de mel vendidos na feira.',
  },
];

type MetaSeed = {
  representanteEmail: string;
  metaVisitas: number;
  metaVendas: number;
  /** Sem campanha: meta mensal do mês de hoje; com campanha: no período dela. */
  campanha?: typeof NOME_FEIRA;
};

const METAS_DEMO: MetaSeed[] = [
  { representanteEmail: EMAIL_EDUARDA, metaVisitas: 20, metaVendas: 6000 },
  { representanteEmail: EMAIL_RAFAEL, metaVisitas: 15, metaVendas: 4000 },
  { representanteEmail: EMAIL_EDUARDA, metaVisitas: 3, metaVendas: 1500, campanha: NOME_FEIRA },
];

async function seedUsuarios(prisma: Banco): Promise<void> {
  const senhaHash = await bcrypt.hash(SENHA_DEMONSTRACAO, CUSTO_HASH);

  for (const { nome, email, role, telefone } of USUARIOS_DEMO) {
    await prisma.user.upsert({
      where: { email },
      update: { nome, senhaHash, role, telefone, ativo: true },
      create: { nome, email, senhaHash, role, telefone },
    });
  }
}

async function seedContato(prisma: Banco, clientId: string, contato: ContatoSeed): Promise<void> {
  const existente = await prisma.contact.findFirst({
    where: { clientId, email: contato.email },
  });

  if (existente) {
    await prisma.contact.update({ where: { id: existente.id }, data: contato });
    return;
  }

  await prisma.contact.create({ data: { ...contato, clientId } });
}

async function seedCliente(prisma: Banco, cliente: ClienteSeed): Promise<void> {
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
    await seedContato(prisma, client.id, contato);
  }
}

/** Calendário sazonal (Etapa 6A) do ano de hoje e do seguinte; idempotente por `nome` (upsert). */
async function seedEventosSazonais(prisma: Banco, hoje: DataCalendario): Promise<void> {
  const ano = Number(hoje.slice(0, 4));

  for (const evento of eventosSazonaisParaSeed([ano, ano + 1])) {
    const { nome, ...dados } = evento;
    await prisma.seasonalEvent.upsert({ where: { nome }, update: dados, create: evento });
  }
}

/**
 * Campanhas de demonstração; só cria a que ainda não existe com o mesmo
 * nome. Devolve o id de cada uma pela chave usada nas visitas e metas.
 */
async function seedCampanhas(
  prisma: Banco,
  hoje: DataCalendario,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const { inicio, fim, ...campanha } of campanhasDemo(hoje)) {
    const existente = await prisma.campaign.findFirst({ where: { nome: campanha.nome } });
    const { id } =
      existente ??
      (await prisma.campaign.create({
        data: { ...campanha, inicio: colunaDateDaData(inicio), fim: colunaDateDaData(fim) },
      }));
    ids.set(campanha.nome === nomeDoNatal(hoje) ? 'NATAL' : campanha.nome, id);
  }

  return ids;
}

type ItemDoPedidoSeed = { sku: string; produtoNome: string; quantidade: number; precoUnitario: number };

/** Nome e preço do catálogo do ERP, como o check-in grava. */
function itensDoPedido(itens: ItemSeed[]): ItemDoPedidoSeed[] {
  return itens.map(({ sku, quantidade }) => {
    const produto = buscarProduto(sku);
    if (!produto) throw new Error(`SKU ${sku} do seed não existe no catálogo do ERP.`);
    return { sku, produtoNome: produto.nome, quantidade, precoUnitario: produto.precoUnitario };
  });
}

/**
 * Idempotente por cliente: se o cliente já tem visita registrada, pula (não
 * duplica) — o `semear` não renova visitas; quem renova é o reinício.
 */
async function seedVisitas(prisma: Banco, hoje: Date, campanhas: Map<string, string>): Promise<void> {
  const diasAtras = (dias: number): Date => new Date(hoje.getTime() - dias * MILISSEGUNDOS_POR_DIA);

  for (const { emailCliente, visitas } of VISITAS_DEMO) {
    const cliente = await prisma.client.findFirst({
      where: { email: emailCliente },
      include: { contacts: { where: { principal: true } } },
    });
    if (!cliente) continue;

    const jaTemVisitas = await prisma.visit.count({ where: { clientId: cliente.id } });
    if (jaTemVisitas > 0) continue;

    const [contatoPrincipal] = cliente.contacts;

    for (const visita of visitas) {
      await prisma.visit.create({
        data: {
          clientId: cliente.id,
          userId: cliente.representanteId,
          contactId: contatoPrincipal?.id ?? null,
          dataHora: diasAtras(visita.diasAtras),
          descricao: visita.descricao,
          resultado: visita.resultado,
          campanhaId: visita.campanha ? (campanhas.get(visita.campanha) ?? null) : null,
          itens: { create: itensDoPedido(visita.itens ?? []) },
        },
      });
    }
  }
}

/** Só marca a próxima visita em cliente que ainda não tem uma (não sobrescreve check-in do app). */
async function seedProximasVisitas(
  prisma: Banco,
  hoje: DataCalendario,
  campanhas: Map<string, string>,
): Promise<void> {
  for (const { emailCliente, diasAFrente, lembrete, campanha } of PROXIMAS_VISITAS_DEMO) {
    await prisma.client.updateMany({
      where: { email: emailCliente, proximaVisita: null },
      data: {
        proximaVisita: colunaDateDaData(somarDias(hoje, diasAFrente)),
        lembrete,
        proximaCampanhaId: campanha ? (campanhas.get(campanha) ?? null) : null,
      },
    });
  }
}

/** Só cria a meta que ainda não existe (mesmo representante, período, início, fim e campanha). */
async function seedMetas(prisma: Banco, hoje: DataCalendario, campanhas: Map<string, string>): Promise<void> {
  const periodosDasCampanhas = new Map(campanhasDemo(hoje).map((campanha) => [campanha.nome, campanha]));

  for (const { representanteEmail, metaVisitas, metaVendas, campanha } of METAS_DEMO) {
    const { id: representanteId } = await prisma.user.findUniqueOrThrow({ where: { email: representanteEmail } });
    const { inicio, fim } = (campanha && periodosDasCampanhas.get(campanha)) || periodoDaMeta('MENSAL', hoje);
    const dados = {
      representanteId,
      periodo: campanha ? ('CAMPANHA' as const) : ('MENSAL' as const),
      inicio: colunaDateDaData(inicio),
      fim: colunaDateDaData(fim),
      campanhaId: campanha ? (campanhas.get(campanha) ?? null) : null,
    };

    const existente = await prisma.goal.findFirst({ where: dados });
    if (existente) continue;

    await prisma.goal.create({ data: { ...dados, metaVisitas, metaVendas } });
  }
}

/**
 * Carga de demonstração que só acrescenta (`npm run db:seed`): devolve às
 * contas, clientes e contatos de demonstração os valores do seed (as contas
 * voltam à senha de demonstração e ficam ativas) e cria o que falta —
 * eventos sazonais, campanhas pelo nome, visitas em cliente ainda sem visita,
 * próxima visita em cliente sem uma e metas que não existem. Não apaga nada.
 */
export async function semear(prisma: Banco, hoje: Date): Promise<void> {
  const dia = dataCalendario(hoje);

  await seedUsuarios(prisma);
  for (const cliente of CLIENTES) {
    await seedCliente(prisma, cliente);
  }
  await seedEventosSazonais(prisma, dia);
  const campanhas = await seedCampanhas(prisma, dia);
  await seedVisitas(prisma, hoje, campanhas);
  await seedProximasVisitas(prisma, dia, campanhas);
  await seedMetas(prisma, dia, campanhas);
}

/**
 * Renova a demonstração (`npm run db:seed:reset`), numa transação só: se algo
 * falhar no meio (inclusive no `semear`), nada é apagado. Apaga, nesta ordem (quem
 * depende antes de quem é referenciado), metas, itens de pedido, visitas,
 * mensagens de estoque, mudanças de recorrência, contatos, clientes,
 * campanhas e tokens de redefinição de senha — inclusive o que o app gravou —
 * e recria tudo com `semear`, com datas relativas a `hoje`. As contas de
 * demonstração voltam à senha de demonstração e ficam ativas; os demais
 * usuários (criados pelo app) ficam intactos, com a senha deles. Os eventos
 * sazonais não são apagados (o upsert os mantém em dia).
 */
export async function reiniciarDemonstracao(prisma: PrismaClient, hoje: Date): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.goal.deleteMany();
      await tx.visitItem.deleteMany();
      await tx.visit.deleteMany();
      await tx.stockMessage.deleteMany();
      await tx.visitScheduleChange.deleteMany();
      await tx.contact.deleteMany();
      await tx.client.deleteMany();
      await tx.campaign.deleteMany();
      await tx.passwordResetToken.deleteMany();

      await semear(tx, hoje);
    },
    { timeout: PRAZO_DA_TRANSACAO_MS, maxWait: 10_000 },
  );
}
