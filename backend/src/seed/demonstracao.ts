import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient, ResultadoVisita, TipoCampanha } from '@prisma/client';
// erpIds (códigos numéricos de 5 dígitos) calibrados para o ERP simulado
// (cor composta com rebaixamento por última compra no ERP) — ver comentário
// de calibração em config/erpIdsDemonstracao.ts.
import { ERP_IDS_DEMONSTRACAO } from '../config/erpIdsDemonstracao';
import { eventosSazonaisParaSeed } from '../config/eventosSazonaisSeed';
// O seed usa o catálogo de demonstração direto, seja qual for o provedor de
// ERP, e o grava em `ErpProduct`: em produção (`importado`) o catálogo do ERP
// é o aprendido das notas, que não teria os SKUs da demonstração.
import { CATALOGO } from '../providers/erp/mock/catalogo';
import {
  colunaDateDaData,
  dataCalendario,
  inicioDoDia,
  somarDias,
  type DataCalendario,
} from '../services/classificacao.service';
import { periodoDaMeta } from '../services/goal.regras';

/**
 * Dados de demonstração do ChokoCRM (spec da Etapa 8, seção 9), usados por
 * `prisma/seed.ts`: `semear` só acrescenta (`npm run db:seed`) e
 * `reiniciarDemonstracao` apaga e recria (`npm run db:seed:reset`). Fica em
 * `src/` (não em `prisma/`) porque `tsconfig.json` só inclui `src` e
 * `tests`, e `tests/seed.test.ts` chama as duas funções direto, como
 * `config/eventosSazonaisSeed.ts`. Todas as datas são relativas ao `hoje`
 * recebido, para a demonstração nascer com cores, agenda, campanhas e metas
 * do dia em que roda; `prisma/seed.ts` passa `agora()` (`lib/relogio.ts`), a
 * data de demonstração quando `DATA_DE_DEMONSTRACAO` está definida. Até o
 * `criadoEm` dos clientes novos é `hoje` (base da primeira visita de quem
 * nunca foi visitado). Os pedidos usam o catálogo de demonstração direto
 * (`CATALOGO`), seja qual for o `ERP_PROVIDER`: o seed roda igual no mock e
 * no importado (produção). O mesmo catálogo vai para `ErpProduct`, para que,
 * no importado, as campanhas e o check-in da demonstração achem os produtos.
 * Os 26 clientes (`CLIENTES`) formam as carteiras da Eduarda (16) e do Rafael
 * (10), cada uma nas cidades da sua rota, com cadastro de sistema de verdade:
 * CNPJ com dígitos verificadores válidos, razão social, endereço, telefone e
 * e-mail no domínio do cliente, de 1 a 2 contatos (um principal) e, em todos
 * menos dois, `erpId` numérico; nada com cara de dado de teste. Cada cliente
 * tem a sua recorrência (7 a 60 dias) e um histórico de visitas que a
 * respeita (`VISITAS_DEMO`, pedidos de 1 a 4 itens), fora os casos de
 * propósito descritos lá; um cliente é inativo. As visitas caem em horário
 * comercial de São Paulo (8h às 17h59), com hora e minuto variados e
 * determinísticos por visita (`horarioDaVisita`), nunca depois de `hoje`.
 * Os usuários são os dois representantes de demonstração (Eduarda e Rafael,
 * que voltam à senha de demonstração no reset) e a conta compartilhada
 * "Gestão Chokolaten" (`EMAIL_GESTAO`), usada pelo dono e pelo escritório:
 * é uma conta real, então o seed só a cria (com a senha de demonstração) em
 * banco novo e nunca sobrescreve a senha dela; a conta pessoal do gestor das
 * versões anteriores (`gestor@chokolaten.com.br`) fica inativa.
 */

/**
 * Senha das contas de demonstração (publicada no guia de desenvolvimento): a
 * dos representantes, e a da conta Gestão só quando o seed a cria.
 */
export const SENHA_DEMONSTRACAO = 'chokocrm123';
const CUSTO_HASH = 10;
const MILISSEGUNDOS_POR_DIA = 86_400_000;
const MILISSEGUNDOS_POR_HORA = 3_600_000;
const MILISSEGUNDOS_POR_MINUTO = 60_000;

/** O cliente do Prisma ou o de uma transação interativa: o seed roda nos dois. */
type Banco = PrismaClient | Prisma.TransactionClient;

/**
 * Prazo da transação do reinício: o padrão do Prisma (5 s) não cobre o hash
 * das senhas e as ~300 gravações do seed num banco remoto.
 */
const PRAZO_DA_TRANSACAO_MS = 120_000;

export type ModoDoSeed = 'semear' | 'reiniciar' | 'recusar';

/** Aviso de `--reset` em produção ou com banco remoto sem `--confirmar` (o processo sai com código 1). */
export const AVISO_RESET_SEM_CONFIRMACAO = [
  'Reinício da demonstração recusado: o ambiente é de produção ou o banco é remoto (não é localhost).',
  'O --reset apaga TODOS os clientes, contatos, visitas, pedidos, lembretes, mensagens de estoque, campanhas e metas,',
  'inclusive os registrados pelos representantes de verdade (por exemplo, na validação); só as contas ficam.',
  'Para confirmar, rode de novo com --confirmar:  npm run db:seed:reset -- --confirmar',
].join('\n');

/** Hosts que contam como banco local: a máquina de desenvolvimento e o serviço `db` do Docker Compose. */
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', 'db']);

/** O host da `DATABASE_URL` é local? URL malformada conta como remota (na dúvida, pede confirmação). */
function bancoLocal(databaseUrl: string): boolean {
  try {
    return HOSTS_LOCAIS.has(new URL(databaseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * O que `prisma/seed.ts` faz com os argumentos: sem `--reset`, só acrescenta;
 * com `--reset`, reinicia — em produção ou com banco remoto (host da
 * `DATABASE_URL` que não é localhost, 127.0.0.1, ::1 nem `db`), só com
 * `--confirmar` também, para o comando destrutivo não rodar por engano
 * (rulings R32 e R34: não depende só do `NODE_ENV`).
 */
export function modoDoSeed(argumentos: readonly string[], ambiente: string, databaseUrl: string): ModoDoSeed {
  if (!argumentos.includes('--reset')) return 'semear';
  const exigeConfirmacao = ambiente === 'production' || !bancoLocal(databaseUrl);
  if (exigeConfirmacao && !argumentos.includes('--confirmar')) return 'recusar';
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
  /**
   * Dono da carteira; os 16 primeiros clientes são da Eduarda (Joinville, Jaraguá do Sul, Corupá,
   * São Bento do Sul e Pomerode), os 10 últimos do Rafael (Blumenau, Indaial, Timbó, Brusque,
   * Itajaí e Rio do Sul), cada carteira na ordem da rota.
   */
  representanteEmail: string;
  /**
   * Intervalo entre visitas, em dias (7 a 60: semanal nos dois clientes grandes,
   * quinzenal, mensal, a cada 45 dias e bimestral); sem valor, 15, o padrão do banco.
   */
  recorrenciaDias?: number;
  /** `false` só no cliente fechado para reforma: guarda o histórico, sem próxima visita nem lembrete. */
  ativo?: boolean;
};

const EMAIL_EDUARDA = 'eduarda@chokolaten.com.br';
const EMAIL_RAFAEL = 'rafael@chokolaten.com.br';
/** Conta compartilhada da gestão (dono e escritório), já criada em produção pelo app. */
export const EMAIL_GESTAO = 'gestao@chokolaten.com.br';
/** Conta pessoal do gestor das versões anteriores do seed: fica inativa (não é apagada). */
const EMAIL_GESTOR_ANTIGO = 'gestor@chokolaten.com.br';

const CLIENTES: ClienteSeed[] = [
  // Carteira da Eduarda, na ordem da rota: Joinville, Jaraguá do Sul, Corupá, São Bento do Sul e Pomerode.
  {
    razaoSocial: 'Alves & Filhos Comércio de Alimentos Ltda',
    nomeFantasia: 'Mercado Central Joinville',
    cnpj: '15327045000142',
    cidade: 'Joinville',
    endereco: 'Rua do Príncipe, 800 - Centro, Joinville/SC',
    telefone: '(47) 3433-1867',
    email: 'contato@mercadocentraljoinville.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 7,
    contatos: [
      {
        nome: 'Roberto Alves',
        cargo: 'Gerente de Compras',
        telefone: '(47) 99137-4528',
        email: 'roberto.alves@mercadocentraljoinville.com.br',
        principal: true,
      },
      {
        nome: 'Sílvia Alves',
        cargo: 'Proprietária',
        telefone: '(47) 98846-1709',
        email: 'silvia.alves@mercadocentraljoinville.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Souza Cafeteria e Eventos Ltda',
    nomeFantasia: 'Cafeteria Estrada Bonita',
    cnpj: '39007747000107',
    cidade: 'Joinville',
    endereco: 'Rua Dona Francisca, 11.800 - Pirabeiraba, Joinville/SC',
    telefone: '(47) 3455-2194',
    email: 'contato@cafeteriaestradabonita.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Fernanda Souza',
        cargo: 'Gerente',
        telefone: '(47) 99652-3184',
        email: 'fernanda.souza@cafeteriaestradabonita.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Frida Lange Confeitaria Ltda',
    nomeFantasia: 'Confeitaria Dona Frida',
    cnpj: '34331603000198',
    cidade: 'Joinville',
    endereco: 'Rua Otto Boehm, 415 - América, Joinville/SC',
    telefone: '(47) 3422-6181',
    email: 'contato@confeitariadonafrida.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Ingrid Lange',
        cargo: 'Proprietária',
        telefone: '(47) 99127-4035',
        email: 'ingrid.lange@confeitariadonafrida.com.br',
        principal: true,
      },
      {
        nome: 'Paulo Lange',
        cargo: 'Comprador',
        telefone: '(47) 98803-5917',
        email: 'paulo.lange@confeitariadonafrida.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Palmeiras Café e Bistrô Ltda',
    nomeFantasia: 'Café Rua das Palmeiras',
    cnpj: '26301847000108',
    cidade: 'Joinville',
    endereco: 'Rua das Palmeiras, 37 - Centro, Joinville/SC',
    telefone: '(47) 3027-4410',
    email: 'contato@caferuadaspalmeiras.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Renata Kohler',
        cargo: 'Gerente',
        telefone: '(47) 98834-2761',
        email: 'renata.kohler@caferuadaspalmeiras.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'J. Schulz Mercearia ME',
    nomeFantasia: 'Mercearia Bom Retiro',
    cnpj: '46594713000121',
    cidade: 'Joinville',
    endereco: 'Rua Copacabana, 1.022 - Bom Retiro, Joinville/SC',
    telefone: '(47) 3436-2290',
    email: 'contato@merceariabomretiro.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 45,
    contatos: [
      {
        nome: 'José Schulz',
        cargo: 'Proprietário',
        telefone: '(47) 99604-8352',
        email: 'jose.schulz@merceariabomretiro.com.br',
        principal: true,
      },
      {
        nome: 'Ana Paula Schulz',
        cargo: 'Compradora',
        telefone: '(47) 99171-6430',
        email: 'anapaula.schulz@merceariabomretiro.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Bauer Doces e Salgados Ltda',
    nomeFantasia: 'Doceria Jaraguá',
    cnpj: '44168350000137',
    cidade: 'Jaraguá do Sul',
    endereco: 'Rua Reinoldo Rau, 220 - Centro, Jaraguá do Sul/SC',
    telefone: '(47) 3275-1468',
    email: 'contato@doceriajaragua.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Cristiane Bauer',
        cargo: 'Proprietária',
        telefone: '(47) 99914-7286',
        email: 'cristiane.bauer@doceriajaragua.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Moretti Panificadora Ltda',
    nomeFantasia: 'Panificadora Vila Lenzi',
    cnpj: '28952634000163',
    cidade: 'Jaraguá do Sul',
    endereco: 'Rua José Theodoro Ribeiro, 1.480 - Vila Lenzi, Jaraguá do Sul/SC',
    telefone: '(47) 3370-4815',
    email: 'contato@panificadoravilalenzi.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 7,
    contatos: [
      {
        nome: 'Giovana Moretti',
        cargo: 'Proprietária',
        telefone: '(47) 99188-2069',
        email: 'giovana.moretti@panificadoravilalenzi.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Stein Casa de Chá e Eventos Ltda',
    nomeFantasia: 'Casa de Chá Recanto Alemão',
    cnpj: '38272408000195',
    cidade: 'Jaraguá do Sul',
    endereco: 'Rua Bernardo Dornbusch, 2.210 - Baependi, Jaraguá do Sul/SC',
    telefone: '(47) 3371-5520',
    email: 'contato@recantoalemao.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Elfrida Stein',
        cargo: 'Proprietária',
        telefone: '(47) 99230-1847',
        email: 'elfrida.stein@recantoalemao.com.br',
        principal: true,
      },
      {
        nome: 'Marcos Stein',
        cargo: 'Sócio',
        telefone: '(47) 98417-6302',
        email: 'marcos.stein@recantoalemao.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Piske Confeitaria e Cafeteria Ltda',
    nomeFantasia: 'Confeitaria Rota das Cachoeiras',
    cnpj: '16945161000198',
    cidade: 'Corupá',
    endereco: 'Rua Getúlio Vargas, 450 - Centro, Corupá/SC',
    telefone: '(47) 3375-6293',
    email: 'contato@rotadascachoeiras.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 45,
    contatos: [
      {
        nome: 'Marcelo Piske',
        cargo: 'Proprietário',
        telefone: '(47) 99743-5376',
        email: 'marcelo.piske@rotadascachoeiras.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Hruschka Turismo e Hospedagem Ltda',
    nomeFantasia: 'Hotel Fazenda Rio Novo',
    cnpj: '46949783000155',
    cidade: 'Corupá',
    endereco: 'Rua Rio Novo, 3.900 - Rio Novo, Corupá/SC',
    telefone: '(47) 3375-1840',
    email: 'reservas@hotelfazendarionovo.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 60,
    contatos: [
      {
        nome: 'Cláudio Hruschka',
        cargo: 'Gerente',
        telefone: '(47) 99145-6721',
        email: 'claudio@hotelfazendarionovo.com.br',
        principal: true,
      },
      {
        nome: 'Vera Hruschka',
        cargo: 'Sócia',
        telefone: '(47) 98872-0394',
        email: 'vera@hotelfazendarionovo.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Wolf Comércio de Alimentos Ltda',
    nomeFantasia: 'Armazém São Bento',
    cnpj: '49610663000117',
    cidade: 'São Bento do Sul',
    endereco: 'Rua XV de Novembro, 900 - Centro, São Bento do Sul/SC',
    telefone: '(47) 3633-4172',
    email: 'contato@armazemsaobento.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Luciane Wolf',
        cargo: 'Gerente',
        telefone: '(47) 99628-1957',
        email: 'luciane.wolf@armazemsaobento.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Treml Café Colonial Ltda',
    nomeFantasia: 'Café Colonial Serra Alta',
    cnpj: '25804541000101',
    cidade: 'São Bento do Sul',
    endereco: 'Rua Jorge Lacerda, 1.350 - Serra Alta, São Bento do Sul/SC',
    telefone: '(47) 3635-2730',
    email: 'contato@cafecolonialserraalta.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Lúcia Treml',
        cargo: 'Proprietária',
        telefone: '(47) 99174-8615',
        email: 'lucia.treml@cafecolonialserraalta.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Grosskopf Panificadora Ltda',
    nomeFantasia: 'Padaria Rainha da Serra',
    cnpj: '37629266000108',
    cidade: 'São Bento do Sul',
    endereco: 'Rua Antônio Kaesemodel, 512 - Centenário, São Bento do Sul/SC',
    telefone: '(47) 3626-3158',
    email: 'contato@padariarainhadaserra.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Edson Grosskopf',
        cargo: 'Proprietário',
        telefone: '(47) 99203-7148',
        email: 'edson.grosskopf@padariarainhadaserra.com.br',
        principal: true,
      },
      {
        nome: 'Mariane Grosskopf',
        cargo: 'Compradora',
        telefone: '(47) 98466-2593',
        email: 'mariane.grosskopf@padariarainhadaserra.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Weber & Siewert Comércio de Alimentos Ltda',
    nomeFantasia: 'Empório Pomerode',
    cnpj: '11017166000137',
    cidade: 'Pomerode',
    endereco: 'Rua Hermann Weege, 620 - Centro, Pomerode/SC',
    telefone: '(47) 3395-1764',
    email: 'contato@emporiopomerode.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Marta Weber',
        cargo: 'Compradora',
        telefone: '(47) 99316-8742',
        email: 'marta.weber@emporiopomerode.com.br',
        principal: true,
      },
      {
        nome: 'João Siewert',
        cargo: 'Proprietário',
        telefone: '(47) 98705-1263',
        email: 'joao.siewert@emporiopomerode.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Hoffmann Chocolates e Presentes Ltda',
    nomeFantasia: 'Empório do Chocolate',
    cnpj: '42293000000177',
    cidade: 'Pomerode',
    endereco: 'Rua XV de Novembro, 1.050 - Centro, Pomerode/SC',
    telefone: '(47) 3387-5931',
    email: 'contato@emporiodochocolate.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Patrícia Hoffmann',
        cargo: 'Compradora',
        telefone: '(47) 99958-3417',
        email: 'patricia.hoffmann@emporiodochocolate.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Krause Doces Artesanais Ltda',
    nomeFantasia: 'Doceria Enxaimel',
    cnpj: '42451115000142',
    cidade: 'Pomerode',
    endereco: 'Rua Ribeirão Herdt, 215 - Ribeirão Herdt, Pomerode/SC',
    telefone: '(47) 3387-4026',
    email: 'contato@doceriaenxaimel.com.br',
    representanteEmail: EMAIL_EDUARDA,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Heloísa Krause',
        cargo: 'Proprietária',
        telefone: '(47) 99161-7302',
        email: 'heloisa.krause@doceriaenxaimel.com.br',
        principal: true,
      },
      {
        nome: 'Bruno Krause',
        cargo: 'Sócio',
        telefone: '(47) 98912-4586',
        email: 'bruno.krause@doceriaenxaimel.com.br',
        principal: false,
      },
    ],
  },
  // Carteira do Rafael, na ordem da rota: Blumenau, Indaial, Timbó, Brusque, Itajaí e Rio do Sul.
  {
    razaoSocial: 'Krüger Café e Confeitaria Ltda',
    nomeFantasia: 'Café Blumenau',
    cnpj: '10344962000111',
    cidade: 'Blumenau',
    endereco: 'Rua XV de Novembro, 500 - Centro, Blumenau/SC',
    telefone: '(47) 3322-6045',
    email: 'contato@cafeblumenau.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Helena Krüger',
        cargo: 'Gerente',
        telefone: '(47) 99933-5871',
        email: 'helena.kruger@cafeblumenau.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Haertel Confeitaria e Cafeteria Ltda',
    nomeFantasia: 'Confeitaria Vila Germânica',
    cnpj: '37946439000111',
    cidade: 'Blumenau',
    endereco: 'Rua Alberto Stein, 199 - Velha, Blumenau/SC',
    telefone: '(47) 3326-1955',
    email: 'contato@confeitariavilagermanica.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Rita Haertel',
        cargo: 'Proprietária',
        telefone: '(47) 99112-6083',
        email: 'rita.haertel@confeitariavilagermanica.com.br',
        principal: true,
      },
      {
        nome: 'Felipe Haertel',
        cargo: 'Comprador',
        telefone: '(47) 98827-3145',
        email: 'felipe.haertel@confeitariavilagermanica.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Gaulke Comércio de Alimentos ME',
    nomeFantasia: 'Empório Itoupava',
    cnpj: '30223526000100',
    cidade: 'Blumenau',
    endereco: 'Rua Dr. Pedro Zimmermann, 6.410 - Itoupava Central, Blumenau/SC',
    telefone: '(47) 3337-2201',
    email: 'contato@emporioitoupava.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Rodrigo Gaulke',
        cargo: 'Proprietário',
        telefone: '(47) 99281-4796',
        email: 'rodrigo.gaulke@emporioitoupava.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Dalfovo Panificadora Ltda',
    nomeFantasia: 'Padaria Confeitaria Indaial',
    cnpj: '20952813000199',
    cidade: 'Indaial',
    endereco: 'Rua Presidente Castelo Branco, 280 - Centro, Indaial/SC',
    telefone: '(47) 3333-2716',
    email: 'contato@padariaconfeitariaindaial.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Tiago Dalfovo',
        cargo: 'Proprietário',
        telefone: '(47) 99855-1238',
        email: 'tiago.dalfovo@padariaconfeitariaindaial.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Zimmermann Panificadora Ltda',
    nomeFantasia: 'Padaria Vale Europeu',
    cnpj: '16674624000124',
    cidade: 'Timbó',
    endereco: 'Rua 7 de Setembro, 150 - Centro, Timbó/SC',
    telefone: '(47) 3382-1539',
    email: 'contato@padariavaleeuropeu.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Sandra Zimmermann',
        cargo: 'Proprietária',
        telefone: '(47) 99726-9014',
        email: 'sandra.zimmermann@padariavaleeuropeu.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Pasold Hotelaria e Turismo Ltda',
    nomeFantasia: 'Hotel Fazenda Mulde',
    cnpj: '11802149000100',
    cidade: 'Timbó',
    endereco: 'Rua Mulde Alta, 4.200 - Mulde, Timbó/SC',
    telefone: '(47) 3399-5310',
    email: 'contato@hotelfazendamulde.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 60,
    contatos: [
      {
        nome: 'André Pasold',
        cargo: 'Gerente',
        telefone: '(47) 99196-2847',
        email: 'andre.pasold@hotelfazendamulde.com.br',
        principal: true,
      },
      {
        nome: 'Cristina Pasold',
        cargo: 'Sócia',
        telefone: '(47) 98538-7126',
        email: 'cristina.pasold@hotelfazendamulde.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Becker Comércio de Alimentos Ltda',
    nomeFantasia: 'Empório do Vale Brusque',
    cnpj: '27993094000101',
    cidade: 'Brusque',
    endereco: 'Rua Dr. Maruri, 410 - Centro, Brusque/SC',
    telefone: '(47) 3351-8627',
    email: 'contato@emporiodovalebrusque.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Aline Becker',
        cargo: 'Compradora',
        telefone: '(47) 99811-4693',
        email: 'aline.becker@emporiodovalebrusque.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Casa de Chás e Doces Itajaí Ltda',
    nomeFantasia: 'Casa de Chás Itajaí',
    cnpj: '48518477000190',
    cidade: 'Itajaí',
    endereco: 'Rua Hercílio Luz, 735 - Centro, Itajaí/SC',
    telefone: '(47) 3344-7058',
    email: 'contato@casadechasitajai.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 15,
    contatos: [
      {
        nome: 'Gustavo Pereira',
        cargo: 'Proprietário',
        telefone: '(47) 99822-6150',
        email: 'gustavo.pereira@casadechasitajai.com.br',
        principal: true,
      },
      {
        nome: 'Camila Rocha',
        cargo: 'Gerente',
        telefone: '(47) 98674-3928',
        email: 'camila.rocha@casadechasitajai.com.br',
        principal: false,
      },
    ],
  },
  {
    razaoSocial: 'Maes Cafeteria e Doceria Ltda',
    nomeFantasia: 'Café Beira-Rio',
    cnpj: '42792026000160',
    cidade: 'Itajaí',
    endereco: 'Rua Pedro Ferreira, 160 - Centro, Itajaí/SC',
    telefone: '(47) 3348-7720',
    email: 'contato@cafebeirario.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 30,
    ativo: false,
    contatos: [
      {
        nome: 'Juliana Maes',
        cargo: 'Proprietária',
        telefone: '(47) 98822-3561',
        email: 'juliana.maes@cafebeirario.com.br',
        principal: true,
      },
    ],
  },
  {
    razaoSocial: 'Lenzi & Cia Comércio de Alimentos Ltda',
    nomeFantasia: 'Mercearia Alto Vale',
    cnpj: '32406429000170',
    cidade: 'Rio do Sul',
    endereco: 'Rua Quinze de Novembro, 1.150 - Centro, Rio do Sul/SC',
    telefone: '(47) 3521-2087',
    email: 'contato@merceariaaltovale.com.br',
    representanteEmail: EMAIL_RAFAEL,
    recorrenciaDias: 30,
    contatos: [
      {
        nome: 'Débora Lenzi',
        cargo: 'Gerente de Compras',
        telefone: '(47) 99844-7205',
        email: 'debora.lenzi@merceariaaltovale.com.br',
        principal: true,
      },
    ],
  },
];

/** Representantes de demonstração: o seed os devolve à senha de demonstração e os reativa. */
const USUARIOS_DEMO = [
  { nome: 'Eduarda Fischer', email: EMAIL_EDUARDA, role: 'REPRESENTANTE' as const, telefone: '(47) 99101-2030' },
  { nome: 'Rafael Schmitt', email: EMAIL_RAFAEL, role: 'REPRESENTANTE' as const, telefone: '(47) 99202-3040' },
];

/** Conta compartilhada da gestão: o seed nunca grava a senha dela no `update`. */
const CONTA_GESTAO = {
  nome: 'Gestão Chokolaten',
  email: EMAIL_GESTAO,
  role: 'GESTOR' as const,
  telefone: '(47) 3387-0000',
};

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
  /** Pedido de 1 a 4 itens do catálogo, em toda visita com VENDA (nas demais, nenhum). */
  itens?: ItemSeed[];
  campanha?: CampanhaDaVisita;
};

type VisitasClienteSeed = {
  emailCliente: string;
  visitas: VisitaSeed[];
};

/**
 * Histórico de visitas por cliente, na voz do representante (o que viu, o que
 * o cliente pediu, o próximo passo), na ordem das rotas de `CLIENTES`. A cor
 * da lista nasce da última visita (até 15 dias: VERDE com venda, AMARELO sem;
 * 16 a 30: LARANJA; mais de 30 ou nenhuma: VERMELHO, rebaixada pelo ERP
 * quando a última compra passa de 60 dias), e a agenda da última visita mais
 * a recorrência do cliente (ou da data marcada, em `PROXIMAS_VISITAS_DEMO`).
 * Fora dos casos de propósito, o intervalo entre visitas fica entre metade e
 * uma vez e meia a recorrência, e a última visita é mais recente que ela (o
 * cliente está em dia). Casos de propósito:
 * - Panificadora Vila Lenzi (semanal): quatro vendas e uma negociação a cada
 *   7 dias, a última há 4 dias, então VERDE.
 * - Mercado Central Joinville (semanal): atrasado e ainda AMARELO
 *   (NEGOCIACAO há 10 dias, prevista há 3).
 * - Doceria Jaraguá: LARANJA (SEM_VENDA há 20 dias), com a próxima visita
 *   marcada vencida há 2 dias (`PROXIMAS_VISITAS_DEMO`).
 * - Casa de Chás Itajaí: atrasada e LARANJA (SEM_VENDA há 20 dias, quinzenal).
 * - Padaria Confeitaria Indaial: nunca visitada, VERMELHO.
 * - Armazém São Bento: VERDE pela visita (VENDA há 9 dias), rebaixado para
 *   LARANJA pelo ERP; o caso vale do dia do reinício até o dia +6 (a
 *   apresentação é 1 a 2 dias depois do reset).
 * - Café Colonial Serra Alta e Padaria Rainha da Serra, também de São Bento
 *   do Sul: as duas mensais, com VENDA há 30 e há 58 dias, caem juntas em
 *   "Hoje" na agenda (LARANJA).
 * - Empório Pomerode (VENDA há 3 dias) e Empório do Vale Brusque (NEGOCIACAO
 *   há 6 dias) vinculadas ao Natal; Empório do Chocolate com VENDA ontem, na
 *   Feira Sabores do Vale.
 * - Café Beira-Rio: inativo (fechou para reforma), com o histórico mantido.
 * - Carteira do Rafael: nenhuma venda nos últimos 30 dias (as dele são de 35
 *   dias para trás), então a conversão dele no painel é 0 %, abaixo da da
 *   Eduarda.
 * - Histórico antigo (Etapa 10): cinco vendas de 5 a 11 meses atrás (Empório
 *   Pomerode, duas; Mercado Central Joinville, Café Blumenau e Casa de Chás
 *   Itajaí), nunca a visita mais recente do cliente, para o Painel em 365
 *   dias mostrar mais do que o de 90. Nenhuma outra visita passa de 90 dias.
 * O usuário de cada visita é o dono da carteira do cliente; os preços dos
 * itens são os do catálogo.
 */
const VISITAS_DEMO: VisitasClienteSeed[] = [
  // Carteira da Eduarda
  {
    emailCliente: 'contato@mercadocentraljoinville.com.br',
    visitas: [
      {
        diasAtras: 10,
        descricao:
          'Ruptura de tabletes ao leite no corredor dos doces. O gerente de compras quer fechar a reposição junto com o pedido de Natal e ficou de mandar as quantidades por WhatsApp.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 17,
        descricao:
          'Reposição semanal da gôndola: tabletes e barras 70% giraram bem com o encarte da semana. Incluíram dragées no caixa rápido.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 60 },
          { sku: 'BARRA-70', quantidade: 30 },
          { sku: 'DRAGEE', quantidade: 12 },
        ],
      },
      {
        diasAtras: 168,
        descricao: 'Pedido do Dia dos Namorados: caixas presente para a ilha da entrada e pães de mel no caixa.',
        resultado: 'VENDA',
        itens: [
          { sku: 'CX-PRESENTE', quantidade: 10 },
          { sku: 'PAO-MEL', quantidade: 18 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@cafeteriaestradabonita.com.br',
    visitas: [
      {
        diasAtras: 12,
        descricao:
          'As trufas acabaram no fim de semana com o movimento da estrada. Pedido de reposição; pediram um expositor de balcão novo.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TRUF-70', quantidade: 12 },
          { sku: 'PAO-MEL', quantidade: 24 },
        ],
      },
      {
        diasAtras: 41,
        descricao: 'Estoque ainda alto depois do feriado. Combinei voltar no mês que vem com a linha de Natal.',
        resultado: 'SEM_VENDA',
      },
    ],
  },
  {
    emailCliente: 'contato@confeitariadonafrida.com.br',
    visitas: [
      {
        diasAtras: 8,
        descricao: 'Pedido de bombons, dragées e trufas para a mesa de doces das encomendas de fim de ano.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BOMB-SORT', quantidade: 10 },
          { sku: 'DRAGEE', quantidade: 8 },
          { sku: 'TRUF-70', quantidade: 6 },
        ],
      },
      {
        diasAtras: 22,
        descricao:
          'Reposição de barras 70% para as coberturas. A dona perguntou se teremos barra de 1 kg; fiquei de consultar a fábrica.',
        resultado: 'VENDA',
        itens: [{ sku: 'BARRA-70', quantidade: 15 }],
      },
    ],
  },
  {
    emailCliente: 'contato@caferuadaspalmeiras.com.br',
    visitas: [
      {
        diasAtras: 18,
        descricao:
          'Movimento fraco com a obra na calçada; ainda têm tabletes do último pedido. Volto quando liberarem a rua.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 46,
        descricao: 'Primeiro pedido com a gerente nova: tabletes para servir com o café e pães de mel no balcão.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 30 },
          { sku: 'PAO-MEL', quantidade: 12 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@merceariabomretiro.com.br',
    visitas: [
      {
        diasAtras: 25,
        descricao:
          'Pedido grande para o mês e meio: tabletes, barras, dragées e bombons. Pagamento no boleto de 28 dias, como de costume.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 48 },
          { sku: 'BARRA-70', quantidade: 24 },
          { sku: 'DRAGEE', quantidade: 10 },
          { sku: 'BOMB-SORT', quantidade: 6 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@doceriajaragua.com.br',
    visitas: [
      {
        diasAtras: 20,
        descricao:
          'Prateleira ainda cheia, giro lento depois do feriado. Não fechou pedido; marquei o retorno para fechar o de Natal.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 34,
        descricao: 'Pedido de trufas e bombons para as encomendas de aniversário do mês.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TRUF-70', quantidade: 10 },
          { sku: 'BOMB-SORT', quantidade: 8 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@panificadoravilalenzi.com.br',
    visitas: [
      {
        diasAtras: 4,
        descricao: 'Reposição da semana: pães de mel e tabletes no caixa. Pediram para antecipar a entrega para quinta.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 36 },
          { sku: 'TAB-LEITE', quantidade: 40 },
        ],
      },
      {
        diasAtras: 11,
        descricao: 'Pedido semanal de pães de mel; incluíram dragées para a confeitaria dos fundos.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 30 },
          { sku: 'DRAGEE', quantidade: 10 },
        ],
      },
      {
        diasAtras: 18,
        descricao:
          'A dona quer caixas presente para os funcionários no fim do ano e pediu preço especial. Mandar a proposta até quinta.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 25,
        descricao: 'Reposição semanal de pães de mel, tabletes e barras 70%.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 30 },
          { sku: 'TAB-LEITE', quantidade: 36 },
          { sku: 'BARRA-70', quantidade: 12 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@recantoalemao.com.br',
    visitas: [
      {
        diasAtras: 9,
        descricao:
          'Apresentei as trufas para acompanhar o chá da tarde. A dona gostou e pediu algumas para servir aos clientes no sábado antes de fazer o pedido.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 38,
        descricao: 'Pedido de bombons para servir com o chá e caixas presente para a lojinha da entrada.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BOMB-SORT', quantidade: 6 },
          { sku: 'CX-PRESENTE', quantidade: 6 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@rotadascachoeiras.com.br',
    visitas: [
      {
        diasAtras: 14,
        descricao:
          'A temporada das cachoeiras está começando e o movimento de turistas subiu. Pedido de barras, tabletes e pães de mel para a vitrine.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BARRA-70', quantidade: 20 },
          { sku: 'TAB-LEITE', quantidade: 36 },
          { sku: 'PAO-MEL', quantidade: 12 },
        ],
      },
      {
        diasAtras: 58,
        descricao: 'Fora de temporada, estoque parado. Combinei voltar quando o movimento das trilhas recomeçar.',
        resultado: 'SEM_VENDA',
      },
    ],
  },
  {
    emailCliente: 'reservas@hotelfazendarionovo.com.br',
    visitas: [
      {
        diasAtras: 27,
        descricao: 'Pedido de bombons para a cortesia dos quartos e dragées para o café colonial do hotel.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BOMB-SORT', quantidade: 15 },
          { sku: 'DRAGEE', quantidade: 12 },
        ],
      },
      {
        diasAtras: 85,
        descricao: 'Pedido para o festival de inverno do hotel: trufas para o bufê e caixas presente para os hóspedes.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TRUF-70', quantidade: 12 },
          { sku: 'CX-PRESENTE', quantidade: 10 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@armazemsaobento.com.br',
    visitas: [
      {
        diasAtras: 9,
        descricao:
          'Reposição da linha tradicional para o mês. Pediram para conferir com o financeiro um boleto que consta em aberto.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TRUF-70', quantidade: 15 },
          { sku: 'BARRA-70', quantidade: 20 },
        ],
      },
      {
        diasAtras: 23,
        descricao:
          'A gerente reclamou do atraso na entrega da última remessa e segurou o pedido. Ficou de decidir na próxima visita.',
        resultado: 'NEGOCIACAO',
      },
    ],
  },
  {
    emailCliente: 'contato@cafecolonialserraalta.com.br',
    visitas: [
      {
        diasAtras: 30,
        descricao:
          'Pedido de pães de mel e trufas para o café colonial. Estão montando o cardápio de Natal e pediram preço das caixas presente para revender no balcão.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 24 },
          { sku: 'TRUF-70', quantidade: 8 },
        ],
      },
      {
        diasAtras: 58,
        descricao: 'Pedido de dragées e bombons para o bufê de doces do café colonial nos fins de semana.',
        resultado: 'VENDA',
        itens: [
          { sku: 'DRAGEE', quantidade: 10 },
          { sku: 'BOMB-SORT', quantidade: 6 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@padariarainhadaserra.com.br',
    visitas: [
      {
        diasAtras: 30,
        descricao: 'Balcão reformado, com destaque para a Chokolaten. Pedido de tabletes e dragées para o caixa.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 36 },
          { sku: 'DRAGEE', quantidade: 10 },
        ],
      },
      {
        diasAtras: 58,
        descricao: 'Reposição dos tabletes. O dono pediu sugestão de chocolate para a cobertura dos panetones.',
        resultado: 'VENDA',
        itens: [{ sku: 'TAB-LEITE', quantidade: 24 }],
      },
    ],
  },
  {
    emailCliente: 'contato@emporiopomerode.com.br',
    visitas: [
      {
        diasAtras: 3,
        descricao: 'Reposição do mostruário e primeiro pedido das caixas de Natal, com a vitrine temática montada.',
        resultado: 'VENDA',
        itens: [
          { sku: 'CX-PRESENTE', quantidade: 12 },
          { sku: 'BOMB-SORT', quantidade: 10 },
          { sku: 'TRUF-70', quantidade: 8 },
        ],
        campanha: 'NATAL',
      },
      {
        diasAtras: 20,
        descricao: 'Mostrei as caixas de Natal e a vitrine da campanha; pediu a proposta por escrito com o desconto.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 200,
        descricao: 'Pedido das caixas do Dia das Mães e reposição das trufas.',
        resultado: 'VENDA',
        itens: [
          { sku: 'CX-PRESENTE', quantidade: 8 },
          { sku: 'TRUF-70', quantidade: 12 },
        ],
      },
      {
        diasAtras: 330,
        descricao: 'Pedido das festas de fim de ano: bombons sortidos e caixas presente para a vitrine.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BOMB-SORT', quantidade: 10 },
          { sku: 'CX-PRESENTE', quantidade: 10 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@emporiodochocolate.com.br',
    visitas: [
      {
        diasAtras: 1,
        descricao: 'Visita no estande da feira; pedido de pães de mel, trufas e dragées para a vitrine.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 24 },
          { sku: 'TRUF-70', quantidade: 10 },
          { sku: 'DRAGEE', quantidade: 8 },
        ],
        campanha: NOME_FEIRA,
      },
      {
        diasAtras: 16,
        descricao: 'Reposição de barras e tabletes. Convidei para o estande da Chokolaten na feira de Blumenau.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BARRA-70', quantidade: 18 },
          { sku: 'TAB-LEITE', quantidade: 30 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@doceriaenxaimel.com.br',
    visitas: [
      {
        diasAtras: 11,
        descricao: 'Quer montar cestas de Natal com produtos da Chokolaten; pediu a tabela com preço por volume.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 41,
        descricao: 'Pedido de bombons e pães de mel para a vitrine da rua turística.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BOMB-SORT', quantidade: 8 },
          { sku: 'PAO-MEL', quantidade: 18 },
        ],
      },
    ],
  },
  // Carteira do Rafael (nenhuma venda nos últimos 30 dias)
  {
    emailCliente: 'contato@cafeblumenau.com.br',
    visitas: [
      {
        diasAtras: 10,
        descricao: 'Apresentei as caixas de Natal e os bombons sortidos; a gerente pediu a tabela de preços atualizada.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 25,
        descricao: 'Balcão ainda abastecido de dragées do último pedido; a gerente prefere esperar a quinzena que vem. Volto com a tabela nova.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 260,
        descricao: 'Pedido de abertura do café: dragées para acompanhar o expresso e tabletes ao leite na vitrine.',
        resultado: 'VENDA',
        itens: [
          { sku: 'DRAGEE', quantidade: 15 },
          { sku: 'TAB-LEITE', quantidade: 40 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@confeitariavilagermanica.com.br',
    visitas: [
      {
        diasAtras: 13,
        descricao:
          'Movimento ainda forte depois da Oktoberfest. Pediram proposta de trufas e bombons para as encomendas de Natal.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 42,
        descricao: 'Pedido para o período da Oktoberfest: pães de mel, dragées e tabletes para a vitrine.',
        resultado: 'VENDA',
        itens: [
          { sku: 'PAO-MEL', quantidade: 36 },
          { sku: 'DRAGEE', quantidade: 15 },
          { sku: 'TAB-LEITE', quantidade: 48 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@emporioitoupava.com.br',
    visitas: [
      {
        diasAtras: 22,
        descricao: 'A loja está trocando as prateleiras; o dono só volta a comprar depois da reforma, no mês que vem.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 52,
        descricao: 'Pedido de barras 70% e bombons para a gôndola de especiais.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BARRA-70', quantidade: 16 },
          { sku: 'BOMB-SORT', quantidade: 6 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@padariavaleeuropeu.com.br',
    visitas: [
      {
        diasAtras: 26,
        descricao:
          'Pediram pagamento em 30/60 dias para o pedido de Natal. Levar a resposta do financeiro na próxima visita.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 55,
        descricao: 'Pedido de tabletes e pães de mel para o caixa.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 30 },
          { sku: 'PAO-MEL', quantidade: 18 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@hotelfazendamulde.com.br',
    visitas: [
      {
        diasAtras: 28,
        descricao:
          'O hotel vai montar kits de boas-vindas para o fim de ano e pediu orçamento de 80 caixas presente.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 80,
        descricao: 'Pedido de bombons sortidos para os kits de recepção dos hóspedes.',
        resultado: 'VENDA',
        itens: [{ sku: 'BOMB-SORT', quantidade: 20 }],
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
      {
        diasAtras: 20,
        descricao: 'A compradora estava fechando o balanço do mês e pediu para eu voltar depois; deixei o folheto das caixas de Natal.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 35,
        descricao: 'Pedido de barras 70% e tabletes para a gôndola da entrada.',
        resultado: 'VENDA',
        itens: [
          { sku: 'BARRA-70', quantidade: 24 },
          { sku: 'TAB-LEITE', quantidade: 48 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@casadechasitajai.com.br',
    visitas: [
      {
        diasAtras: 20,
        descricao: 'Estoque da vitrine ainda cheio; sem pedido. Pediram para voltar com as novidades de Natal.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 36,
        descricao: 'Reposição de trufas e bombons para acompanhar os chás da casa.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TRUF-70', quantidade: 8 },
          { sku: 'BOMB-SORT', quantidade: 6 },
        ],
      },
      {
        diasAtras: 290,
        descricao: 'Pedido de tabletes e barras para a loja.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 25 },
          { sku: 'BARRA-70', quantidade: 15 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@cafebeirario.com.br',
    visitas: [
      {
        diasAtras: 48,
        descricao: 'O café vai fechar para reforma sem data para reabrir. Sem pedido até lá; a dona avisa quando voltar.',
        resultado: 'SEM_VENDA',
      },
      {
        diasAtras: 77,
        descricao: 'Pedido de tabletes e dragées para o balcão.',
        resultado: 'VENDA',
        itens: [
          { sku: 'TAB-LEITE', quantidade: 24 },
          { sku: 'DRAGEE', quantidade: 8 },
        ],
      },
    ],
  },
  {
    emailCliente: 'contato@merceariaaltovale.com.br',
    visitas: [
      {
        diasAtras: 24,
        descricao:
          'Querem incluir as barras 70% no pedido do mês, mas com preço de atacado. Levar a tabela por volume.',
        resultado: 'NEGOCIACAO',
      },
      {
        diasAtras: 54,
        descricao: 'Pedido mensal de tabletes ao leite para a gôndola.',
        resultado: 'VENDA',
        itens: [{ sku: 'TAB-LEITE', quantidade: 60 }],
      },
    ],
  },
];

type ProximaVisitaSeed = {
  emailCliente: string;
  diasAFrente: number;
  campanha?: CampanhaDaVisita;
};

/**
 * Próxima visita marcada no check-in em três clientes: duas em "Próximos 7
 * dias" na agenda (uma vinculada ao Natal) e uma marcada que já venceu há 2
 * dias, na Doceria Jaraguá — cliente sem visita depois da data marcada, para
 * a marcada ainda valer (Etapa 10d: um check-in no dia marcado ou depois a
 * cumpre, e por isso ela não fica no Empório do Chocolate, visitado ontem).
 * Nenhuma muda a cor, e nenhuma fica no cliente inativo.
 */
const PROXIMAS_VISITAS_DEMO: ProximaVisitaSeed[] = [
  { emailCliente: 'contato@cafeblumenau.com.br', diasAFrente: 2 },
  { emailCliente: 'contato@emporiodovalebrusque.com.br', diasAFrente: 3, campanha: 'NATAL' },
  { emailCliente: 'contato@doceriajaragua.com.br', diasAFrente: -2 },
];

type LembreteSeed = {
  emailCliente: string;
  /** Data do lembrete: hoje + `diasAFrente` (negativo: vencido). */
  diasAFrente: number;
  texto: string;
  concluido?: boolean;
};

/**
 * Lembretes (Etapa 9), criados pelo dono da carteira: três abertos (um
 * vencido há 3 dias) e um já concluído, que não aparece em lugar nenhum.
 */
const LEMBRETES_DEMO: LembreteSeed[] = [
  {
    emailCliente: 'contato@cafeblumenau.com.br',
    diasAFrente: 2,
    texto: 'Levar a tabela de preços atualizada das caixas de Natal para a gerente.',
  },
  {
    emailCliente: 'contato@emporiodovalebrusque.com.br',
    diasAFrente: -3,
    texto: 'Ligar para a sócia e fechar a quantidade das caixas de Natal.',
  },
  {
    emailCliente: 'contato@emporiodochocolate.com.br',
    diasAFrente: 6,
    texto: 'Conferir o giro dos pães de mel vendidos na feira e sugerir a reposição.',
  },
  {
    emailCliente: 'contato@cafeblumenau.com.br',
    diasAFrente: -5,
    texto: 'Enviar o catálogo de Natal por e-mail para a gerente.',
    concluido: true,
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
  { representanteEmail: EMAIL_EDUARDA, metaVisitas: 28, metaVendas: 15000 },
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

  // Conta real (dono e escritório): a senha de demonstração só no `create`, em
  // banco novo; no `update`, a senha que o escritório definiu fica intacta.
  const { nome, email, role, telefone } = CONTA_GESTAO;
  await prisma.user.upsert({
    where: { email },
    update: { nome, role, ativo: true },
    create: { nome, email, senhaHash, role, telefone },
  });

  // Conta de demonstração antiga (gestor pessoal): inativada, não apagada.
  await prisma.user.updateMany({ where: { email: EMAIL_GESTOR_ANTIGO }, data: { ativo: false } });
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

async function seedCliente(prisma: Banco, cliente: ClienteSeed, hoje: Date): Promise<void> {
  const { contatos, representanteEmail, recorrenciaDias = 15, ativo = true, ...cadastro } = cliente;
  const dadosCliente = { ...cadastro, recorrenciaDias, ativo };
  const { id: representanteId } = await prisma.user.findUniqueOrThrow({
    where: { email: representanteEmail },
  });
  const erpId = ERP_IDS_DEMONSTRACAO[cliente.nomeFantasia] ?? null;

  const client = await prisma.client.upsert({
    where: { cnpj: cliente.cnpj },
    update: { ...dadosCliente, representanteId, erpId },
    // `criadoEm` é a base da primeira visita de quem nunca foi visitado.
    create: { ...dadosCliente, representanteId, erpId, criadoEm: hoje },
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

/**
 * Produtos de demonstração no catálogo do ERP importado (`ErpProduct`), por
 * upsert do código: nome e preço voltam aos do `CATALOGO`. Os produtos das
 * notas importadas (outros códigos) ficam como estão.
 */
async function seedProdutos(prisma: Banco): Promise<void> {
  for (const { sku, nome, precoUnitario } of CATALOGO) {
    await prisma.erpProduct.upsert({
      where: { codigo: sku },
      update: { nome, precoUnitario },
      create: { codigo: sku, nome, precoUnitario },
    });
  }
}

type ItemDoPedidoSeed = { sku: string; produtoNome: string; quantidade: number; precoUnitario: number };

/**
 * Nome e preço do catálogo de demonstração, como o check-in grava. Lido de
 * `CATALOGO` direto (não de `erp.service`), seja qual for o provedor.
 */
function itensDoPedido(itens: ItemSeed[]): ItemDoPedidoSeed[] {
  return itens.map(({ sku, quantidade }) => {
    const produto = CATALOGO.find((candidato) => candidato.sku === sku);
    if (!produto) throw new Error(`SKU ${sku} do seed não existe no catálogo de demonstração.`);
    return { sku, produtoNome: produto.nome, quantidade, precoUnitario: produto.precoUnitario };
  });
}

/**
 * Instante da visita `diasAtras` dias antes de `hoje`, no mesmo dia de
 * calendário de sempre (`hoje - n` dias, em São Paulo), em horário comercial:
 * hora `8 + (indice × 3) % 10` (8h a 17h) e minuto `(indice × 17) % 60`, com
 * `indice` = posição do cliente em `VISITAS_DEMO` + posição da visita no
 * cliente (determinístico). Montado a partir de `inicioDoDia` (meia-noite de
 * São Paulo) em milissegundos, não com os setters locais de `Date`: o fuso da
 * máquina pode não ser o de São Paulo. Se o horário calculado ainda não
 * chegou (visita "hoje"), fica às 8h, para nenhuma visita nascer no futuro.
 */
function horarioDaVisita(hoje: Date, diasAtras: number, indice: number): Date {
  const meiaNoite = inicioDoDia(dataCalendario(new Date(hoje.getTime() - diasAtras * MILISSEGUNDOS_POR_DIA))).getTime();
  const hora = 8 + ((indice * 3) % 10);
  const minuto = (indice * 17) % 60;
  const instante = new Date(meiaNoite + hora * MILISSEGUNDOS_POR_HORA + minuto * MILISSEGUNDOS_POR_MINUTO);
  return instante > hoje ? new Date(meiaNoite + 8 * MILISSEGUNDOS_POR_HORA) : instante;
}

/**
 * Idempotente por cliente: se o cliente já tem visita registrada, pula (não
 * duplica) — o `semear` não renova visitas; quem renova é o reinício. Horário
 * de cada visita em `horarioDaVisita`.
 */
async function seedVisitas(prisma: Banco, hoje: Date, campanhas: Map<string, string>): Promise<void> {
  for (const [indiceCliente, { emailCliente, visitas }] of VISITAS_DEMO.entries()) {
    const cliente = await prisma.client.findFirst({
      where: { email: emailCliente },
      include: { contacts: { where: { principal: true } } },
    });
    if (!cliente) continue;

    const jaTemVisitas = await prisma.visit.count({ where: { clientId: cliente.id } });
    if (jaTemVisitas > 0) continue;

    const [contatoPrincipal] = cliente.contacts;

    for (const [indiceVisita, visita] of visitas.entries()) {
      await prisma.visit.create({
        data: {
          clientId: cliente.id,
          userId: cliente.representanteId,
          contactId: contatoPrincipal?.id ?? null,
          dataHora: horarioDaVisita(hoje, visita.diasAtras, indiceCliente + indiceVisita),
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
  for (const { emailCliente, diasAFrente, campanha } of PROXIMAS_VISITAS_DEMO) {
    await prisma.client.updateMany({
      where: { email: emailCliente, proximaVisita: null },
      data: {
        proximaVisita: colunaDateDaData(somarDias(hoje, diasAFrente)),
        proximaCampanhaId: campanha ? (campanhas.get(campanha) ?? null) : null,
      },
    });
  }
}

/**
 * Só cria o lembrete que ainda não existe (mesmo cliente e texto, aberto ou
 * concluído), pelo dono da carteira; o concluído fica concluído `hoje`.
 */
async function seedLembretes(prisma: Banco, hoje: Date): Promise<void> {
  const dia = dataCalendario(hoje);

  for (const { emailCliente, diasAFrente, texto, concluido } of LEMBRETES_DEMO) {
    const cliente = await prisma.client.findFirst({ where: { email: emailCliente } });
    if (!cliente) continue;

    const existente = await prisma.reminder.findFirst({ where: { clientId: cliente.id, texto } });
    if (existente) continue;

    await prisma.reminder.create({
      data: {
        clientId: cliente.id,
        criadoPorId: cliente.representanteId,
        texto,
        data: colunaDateDaData(somarDias(dia, diasAFrente)),
        concluidoEm: concluido ? hoje : null,
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
 * contas, clientes e contatos de demonstração os valores do seed (os
 * representantes de demonstração voltam à senha de demonstração e ficam
 * ativos; a conta Gestão fica ativa com a senha dela, e a conta antiga do
 * gestor, inativa) e cria o que falta —
 * eventos sazonais, produtos de demonstração no catálogo importado
 * (`ErpProduct`, upsert pelo código), campanhas pelo nome, visitas em cliente ainda sem visita,
 * próxima visita em cliente sem uma, lembretes e metas que não existem. Não
 * apaga nada.
 */
export async function semear(prisma: Banco, hoje: Date): Promise<void> {
  const dia = dataCalendario(hoje);

  await seedUsuarios(prisma);
  for (const cliente of CLIENTES) {
    await seedCliente(prisma, cliente, hoje);
  }
  await seedEventosSazonais(prisma, dia);
  await seedProdutos(prisma);
  const campanhas = await seedCampanhas(prisma, dia);
  await seedVisitas(prisma, hoje, campanhas);
  await seedProximasVisitas(prisma, dia, campanhas);
  await seedLembretes(prisma, hoje);
  await seedMetas(prisma, dia, campanhas);
}

/**
 * Renova a demonstração (`npm run db:seed:reset`), numa transação só: se algo
 * falhar no meio (inclusive no `semear`), nada é apagado. Apaga, nesta ordem (quem
 * depende antes de quem é referenciado), metas, lembretes, itens de pedido,
 * visitas, mensagens de estoque, mudanças de recorrência, contatos, clientes,
 * campanhas e tokens de redefinição de senha — inclusive o que o app gravou —
 * e recria tudo com `semear`, com datas relativas a `hoje`. Os
 * representantes de demonstração voltam à senha de demonstração e ficam
 * ativos; a conta Gestão (conta real) fica ativa e mantém a senha dela; a
 * conta antiga do gestor fica inativa; os demais usuários (criados pelo app)
 * ficam intactos, com a senha deles. Os eventos
 * sazonais não são apagados (o upsert os mantém em dia). Nada do ERP
 * importado é apagado — notas, importações e produtos (`ErpProduct`) ficam;
 * os produtos de demonstração voltam ao nome e preço do catálogo pelo upsert.
 * Antes de apagar as visitas, as notas vinculadas (`AUTOMATICO`, `VINCULADA`)
 * ou pendentes voltam a `SEM_VISITA`, sem visita sugerida: a visita delas some,
 * e uma reimportação decide o vínculo de novo. As `RECUSADA` ficam como estão.
 */
export async function reiniciarDemonstracao(prisma: PrismaClient, hoje: Date): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.goal.deleteMany();
      await tx.reminder.deleteMany();
      await tx.erpSale.updateMany({
        where: { vinculoStatus: { in: ['AUTOMATICO', 'VINCULADA', 'PENDENTE'] } },
        data: { vinculoStatus: 'SEM_VISITA', visitaSugeridaId: null },
      });
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
