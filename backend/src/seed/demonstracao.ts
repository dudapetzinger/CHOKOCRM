import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient, TipoCampanha } from '@prisma/client';
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
import { eventoVigente } from '../services/seasonal-event.service';
import { montarMensagemDeEstoque, nomeDoEventoNoTemplate } from '../services/stock-message.template';
import { textoDoLembrete } from './anotacoes';
import { gerarClientes } from './clientes-gerados';
import {
  gerarVisitas,
  mediaMensalDeVendas,
  type ClienteDoGerador,
  type ItemGerado,
  type Proposito,
  type VisitaGerada,
} from './gerador-visitas';
import { diaUtilAnterior, escolherVisitasMarcadas, JANELA_DAS_VISITAS_MARCADAS, proximoDiaUtil } from './proximas-visitas';
import { AGENDA_DAS_ANCORAS, diaDaSemana } from './rotas';
import type { ClienteSeed, ContatoSeed } from './tipos';

/**
 * Dados de demonstração do ChokoCRM, usados por `prisma/seed.ts` e pelo
 * "Modo demonstração" da tela de login (`POST /sistema/demonstracao`):
 * `semear` só acrescenta (`npm run db:seed`) e `reiniciarDemonstracao` apaga
 * e recria (`npm run db:seed:reset`) só os clientes da demonstração (CNPJ em
 * `CLIENTES`), com metas e campanhas; os clientes reais (cadastrados à mão ou
 * pela nota fiscal) ficam com tudo que é deles. Fica em `src/` (não em `prisma/`)
 * porque `tsconfig.json` só inclui `src` e `tests`. Tudo é relativo ao `hoje`
 * recebido (`agora()`, a data do modo demonstração quando ligado), nunca ao
 * relógio da máquina: a demonstração nasce como se o sistema rodasse há 3
 * meses.
 *
 * - Clientes: os 26 âncoras escritos à mão (`CLIENTES_ANCORA`, com todos os
 *   casos de propósito) e os gerados (`clientes-gerados.ts`), cerca de 40 por
 *   representante, cada um com cadastro de sistema de verdade (CNPJ válido,
 *   razão social, endereço, telefone, e-mail no domínio do cliente, 1 a 2
 *   contatos, `erpId` calibrado no ERP simulado em todos — só o Armazém São
 *   Bento é rebaixado pela venda).
 * - Visitas: geradas (`gerador-visitas.ts`) pelas rotas de cada
 *   representante (`rotas.ts`: dia da semana → cidades, recorrências de 7 a
 *   42 dias, múltiplos de 7): 13 semanas, só de segunda a sexta, 4 a 6 por dia
 *   útil por representante, das 8h às 17h em sequência, ~55 % com venda
 *   (pedidos de 1 a 4 itens do `CATALOGO`, coerentes com o tipo do negócio e
 *   a época), anotações do banco de frases (`anotacoes.ts`) sem repetição em
 *   sequência; determinísticas por cliente + data e nunca depois de `hoje`.
 * - Campanhas: a sazonal do mês de `hoje` (em andamento) e a do mês seguinte
 *   (agendada); metas mensais do mês de `hoje` e do seguinte compatíveis com
 *   o ritmo gerado (vendas 10 % acima da média mensal; 5 visitas por dia
 *   útil) e uma da campanha.
 * - Próximas visitas marcadas: os casos de propósito (+2 e +3 adiante, no
 *   próximo dia útil se cair em fim de semana, e uma vencida na Doceria
 *   Jaraguá) e, para cada representante, 2 em cada dia útil de `hoje` a
 *   `hoje + 23`, de preferência na data natural do cliente (a próxima que a
 *   rota prevê; `proximas-visitas.ts`). O calendário fica cheio; ninguém sai
 *   da agenda de hoje (ela pode ganhar 1–2 clientes); amanhã pode perder até
 *   3 (até 4 num reset antes das 9h); nos dias seguintes alguns clientes
 *   aparecem na data marcada em vez da data da recorrência.
 * - Lembretes: por representante, três abertos (um vencido) e um concluído,
 *   com texto coerente com a última visita, sempre em dia útil (o vencido
 *   recua, o futuro avança).
 * - Mensagens de estoque: 3 por representante nas últimas 4 semanas, nos
 *   clientes com venda mais recente, com o texto da regra real
 *   (`montarMensagemDeEstoque`) e o evento sazonal vigente na data.
 *
 * Os pedidos usam o catálogo de demonstração direto (`CATALOGO`), seja qual
 * for o `ERP_PROVIDER`; o mesmo catálogo vai para `ErpProduct`. Os usuários
 * são os dois representantes de demonstração (Eduarda e Rafael, que voltam à
 * senha de demonstração no reset) e a conta compartilhada "Gestão Chokolaten"
 * (`EMAIL_GESTAO`), conta real: o seed só a cria (com a senha de
 * demonstração) em banco novo e nunca sobrescreve a senha dela; a conta
 * pessoal do gestor das versões anteriores (`gestor@chokolaten.com.br`) fica
 * inativa.
 */

/**
 * Senha das contas de demonstração (publicada no guia de desenvolvimento): a
 * dos representantes, e a da conta Gestão só quando o seed a cria.
 */
export const SENHA_DEMONSTRACAO = 'chokocrm123';
const CUSTO_HASH = 10;

/** O cliente do Prisma ou o de uma transação interativa: o seed roda nos dois. */
type Banco = PrismaClient | Prisma.TransactionClient;

/**
 * Prazo da transação do reinício: o padrão do Prisma (5 s) não cobre o hash
 * das senhas e as gravações do seed (cerca de 80 clientes, visitas em lote)
 * num banco remoto.
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

const EMAIL_EDUARDA = 'eduarda@chokolaten.com.br';
const EMAIL_RAFAEL = 'rafael@chokolaten.com.br';
/** Conta compartilhada da gestão (dono e escritório), já criada em produção pelo app. */
export const EMAIL_GESTAO = 'gestao@chokolaten.com.br';
/** Conta pessoal do gestor das versões anteriores do seed: fica inativa (não é apagada). */
const EMAIL_GESTOR_ANTIGO = 'gestor@chokolaten.com.br';

/**
 * Os 26 clientes âncora, escritos à mão (carteiras da Eduarda, 16, e do
 * Rafael, 10, na ordem das rotas). Todos os casos de propósito ficam neles
 * (`PROPOSITOS`); as recorrências são múltiplos de 7 (a rota cai sempre no
 * mesmo dia da semana).
 */
export const CLIENTES_ANCORA: readonly ClienteSeed[] = [
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 42,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 42,
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
    recorrenciaDias: 42,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 42,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 14,
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
    recorrenciaDias: 28,
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
    recorrenciaDias: 28,
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
  {
    nome: 'Eduarda Fischer',
    email: EMAIL_EDUARDA,
    role: 'REPRESENTANTE' as const,
    telefone: '(47) 99101-2030',
  },
  {
    nome: 'Rafael Schmitt',
    email: EMAIL_RAFAEL,
    role: 'REPRESENTANTE' as const,
    telefone: '(47) 99202-3040',
  },
];

/** Conta compartilhada da gestão: o seed nunca grava a senha dela no `update`. */
const CONTA_GESTAO = {
  nome: 'Gestão Chokolaten',
  email: EMAIL_GESTAO,
  role: 'GESTOR' as const,
  telefone: '(47) 3387-0000',
};

/** Clientes gerados (`clientes-gerados.ts`), sem repetir o nome de nenhum contato dos âncoras. */
export const CLIENTES_GERADOS: readonly ClienteSeed[] = gerarClientes(
  new Set(CLIENTES_ANCORA.flatMap((cliente) => cliente.contatos.map((contato) => contato.nome))),
);

/** Clientes da demonstração: os 26 âncoras e os gerados, que completam as carteiras para cerca de 40. */
const CLIENTES: readonly ClienteSeed[] = [...CLIENTES_ANCORA, ...CLIENTES_GERADOS];

/**
 * CNPJs dos clientes da demonstração: o que `reiniciarDemonstracao` apaga e
 * recria. Todo cliente com outro CNPJ é real (cadastrado à mão ou pela nota)
 * e sobrevive ao reset.
 */
export function cnpjsDaDemonstracao(): Set<string> {
  return new Set(CLIENTES.map((cliente) => cliente.cnpj));
}

/**
 * Casos de propósito, todos em clientes âncora (valem para qualquer `hoje`):
 * - Padaria Confeitaria Indaial: nunca visitada (VERMELHO).
 * - Café Beira-Rio: inativo (fechou para reforma), visitas só até 7 semanas atrás.
 * - Três atrasados: Mercado Central Joinville (semanal, uma visita pulada,
 *   a última uma NEGOCIACAO de 8 a 14 dias atrás: AMARELO), Doceria Jaraguá
 *   (quinzenal, sexta-feira, só as visitas até 16 dias antes de `hoje`: a
 *   última de 16 a 29 dias atrás em qualquer dia da semana, sempre LARANJA,
 *   e a próxima visita marcada vencida) e Casa de Chás Itajaí (quinzenal,
 *   três puladas: 43 a 56 dias, VERMELHO).
 * - Armazém São Bento: quinzenal, sempre com venda, a última até 14 dias
 *   atrás, rebaixado para LARANJA pelo ERP (calibração do `erpId`).
 * - Panificadora Vila Lenzi: semanal, sempre com venda (VERDE garantido).
 */
const PROPOSITOS: Record<string, Proposito> = {
  'Padaria Confeitaria Indaial': { tipo: 'NUNCA_VISITADO' },
  'Café Beira-Rio': { tipo: 'INATIVO', semanasSemVisita: 7 },
  'Mercado Central Joinville': {
    tipo: 'ATRASADO',
    recorrenciasPuladas: 1,
    ultimoResultado: 'NEGOCIACAO',
  },
  'Doceria Jaraguá': { tipo: 'ATRASADO', corteDias: 16 },
  'Casa de Chás Itajaí': { tipo: 'ATRASADO', recorrenciasPuladas: 3 },
  'Armazém São Bento': { tipo: 'SEMPRE_VENDA' },
  'Panificadora Vila Lenzi': { tipo: 'SEMPRE_VENDA' },
};

/** Os clientes no formato do gerador de visitas: lugar na rota, contatos e caso de propósito. */
export function clientesDaDemonstracao(): ClienteDoGerador[] {
  return CLIENTES.map((cliente) => {
    const proposito = PROPOSITOS[cliente.nomeFantasia];
    return {
      cnpj: cliente.cnpj,
      nomeFantasia: cliente.nomeFantasia,
      representanteEmail: cliente.representanteEmail,
      cidade: cliente.cidade,
      recorrenciaDias: cliente.recorrenciaDias ?? 14,
      agenda:
        proposito?.tipo === 'NUNCA_VISITADO'
          ? null
          : (cliente.agenda ?? AGENDA_DAS_ANCORAS[cliente.nomeFantasia] ?? null),
      contatos: cliente.contatos,
      ...(proposito ? { proposito } : {}),
    };
  });
}

type CampanhaDoMes = {
  nome: string;
  tipo: TipoCampanha;
  descricao: string;
  desconto: number | null;
  produtos: string[];
};

/** Campanha sazonal de cada mês (o nome ganha o ano); produtos são SKUs do catálogo de demonstração. */
const CAMPANHA_DO_MES: Record<number, CampanhaDoMes> = {
  1: {
    nome: 'Verão Chokolaten',
    tipo: 'PROMOCAO',
    descricao: 'Dragées e tabletes com preço especial nas férias: os que aguentam melhor o calor da vitrine.',
    desconto: 10,
    produtos: ['DRAGEE', 'TAB-LEITE', 'BARRA-70'],
  },
  2: {
    nome: 'Encomendas de Páscoa',
    tipo: 'CAMPANHA',
    descricao: 'Pré-venda dos ovos de Páscoa com entrega escalonada até a Semana Santa.',
    desconto: 8,
    produtos: ['OVO-PASCOA', 'BOMB-SORT', 'TRUF-70'],
  },
  3: {
    nome: 'Páscoa Chokolaten',
    tipo: 'CAMPANHA',
    descricao: 'Ovos, trufas e caixas presente para a vitrine de Páscoa.',
    desconto: 5,
    produtos: ['OVO-PASCOA', 'TRUF-70', 'CX-PRESENTE'],
  },
  4: {
    nome: 'Dia das Mães',
    tipo: 'CAMPANHA',
    descricao: 'Caixas presente e bombons sortidos para o Dia das Mães, com display de balcão.',
    desconto: 8,
    produtos: ['CX-PRESENTE', 'BOMB-SORT', 'BARRA-70'],
  },
  5: {
    nome: 'Dia dos Namorados',
    tipo: 'CAMPANHA',
    descricao: 'Trufas e caixas presente para o Dia dos Namorados, com vitrine temática.',
    desconto: 8,
    produtos: ['CX-PRESENTE', 'TRUF-70', 'BOMB-SORT'],
  },
  6: {
    nome: 'Festa Junina e Inverno',
    tipo: 'PROMOCAO',
    descricao: 'Pães de mel e barras para as festas juninas e o chocolate quente.',
    desconto: 10,
    produtos: ['PAO-MEL', 'BARRA-70', 'TAB-LEITE'],
  },
  7: {
    nome: 'Inverno do Cacau',
    tipo: 'PROMOCAO',
    descricao: 'Barras 70% e tabletes com preço especial para o chocolate quente do inverno.',
    desconto: 12,
    produtos: ['BARRA-70', 'TAB-LEITE', 'PAO-MEL'],
  },
  8: {
    nome: 'Dia dos Pais',
    tipo: 'CAMPANHA',
    descricao: 'Barras, tabletes e dragées para o Dia dos Pais.',
    desconto: 8,
    produtos: ['BARRA-70', 'TAB-LEITE', 'DRAGEE'],
  },
  9: {
    nome: 'Primavera Chokolaten',
    tipo: 'PROMOCAO',
    descricao: 'Bombons e trufas com preço especial na troca de estação.',
    desconto: 10,
    produtos: ['BOMB-SORT', 'DRAGEE', 'TRUF-70'],
  },
  10: {
    nome: 'Oktoberfest Chokolaten',
    tipo: 'EVENTO',
    descricao: 'Pães de mel e barras para o movimento da Oktoberfest de Blumenau e região.',
    desconto: null,
    produtos: ['PAO-MEL', 'BARRA-70', 'DRAGEE'],
  },
  11: {
    nome: 'Encomendas de Natal',
    tipo: 'CAMPANHA',
    descricao: 'Antecipe os pedidos de caixas presente e bombons sortidos até o fim do mês.',
    desconto: 8,
    produtos: ['CX-PRESENTE', 'BOMB-SORT', 'TRUF-70'],
  },
  12: {
    nome: 'Natal Chokolaten',
    tipo: 'CAMPANHA',
    descricao: 'Caixas presente e bombons sortidos com vitrine temática de Natal.',
    desconto: 5,
    produtos: ['CX-PRESENTE', 'BOMB-SORT', 'TRUF-70'],
  },
};

type CampanhaSeed = CampanhaDoMes & {
  inicio: DataCalendario;
  fim: DataCalendario;
};

/** Primeiro dia do mês da data e o último. */
function mesDe(dia: DataCalendario): {
  inicio: DataCalendario;
  fim: DataCalendario;
} {
  const inicio = `${dia.slice(0, 7)}-01`;
  const [ano, mes] = dia.split('-').map(Number) as [number, number];
  const proximo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  return { inicio, fim: somarDias(proximo, -1) };
}

/**
 * A campanha sazonal do mês de `hoje` (em andamento, o mês inteiro) e a do
 * mês seguinte (agendada), com o ano no nome.
 */
function campanhasDemo(hoje: DataCalendario): CampanhaSeed[] {
  const atual = mesDe(hoje);
  const seguinte = mesDe(somarDias(atual.fim, 1));
  return [atual, seguinte].map(({ inicio, fim }) => {
    const modelo = CAMPANHA_DO_MES[Number(inicio.slice(5, 7))] as CampanhaDoMes;
    return {
      ...modelo,
      produtos: [...modelo.produtos],
      nome: `${modelo.nome} ${inicio.slice(0, 4)}`,
      inicio,
      fim,
    };
  });
}

type ProximaVisitaSeed = { nomeFantasia: string; diasAFrente: number };

/**
 * Próximas visitas marcadas de propósito no check-in: duas adiante (+2 e +3,
 * ou o próximo dia útil se cair em fim de semana; só a do Empório do Vale
 * Brusque leva a campanha que estiver valendo na data, se houver) e uma
 * vencida há 2 dias na Doceria Jaraguá, atrasada (nenhuma visita depois de
 * marcá-la). Nenhuma no inativo. As demais marcações (2 por representante em
 * cada dia útil da janela) vêm de `escolherVisitasMarcadas`.
 */
const PROXIMAS_VISITAS_DEMO: ProximaVisitaSeed[] = [
  { nomeFantasia: 'Café Blumenau', diasAFrente: 2 },
  { nomeFantasia: 'Empório do Vale Brusque', diasAFrente: 3 },
  { nomeFantasia: 'Doceria Jaraguá', diasAFrente: -2 },
];

/** O único caso de propósito que leva a campanha na próxima visita. */
const MARCADA_COM_CAMPANHA = 'Empório do Vale Brusque';

function cnpjDoCliente(nomeFantasia: string): string {
  const cliente = CLIENTES.find((candidato) => candidato.nomeFantasia === nomeFantasia);
  if (!cliente) throw new Error(`Cliente de demonstração não encontrado: ${nomeFantasia}`);
  return cliente.cnpj;
}

/**
 * Todas as próximas visitas marcadas da demonstração, CNPJ → dia: os casos de
 * propósito (`PROXIMAS_VISITAS_DEMO`) e, para cada representante, 2 em cada
 * dia útil de `hoje` a `hoje + 23`, de preferência na data natural do
 * cliente (`escolherVisitasMarcadas`; os casos de propósito contam na cota do
 * dia deles; os "sempre com venda" entram só em dia previsto pela rota).
 * Fora os inativos. `visitadosHoje`: CNPJs com visita gerada em `hoje`, que
 * não são marcados para hoje (a marcação já estaria cumprida).
 */
export function visitasMarcadasDaDemonstracao(
  hoje: DataCalendario,
  visitadosHoje: ReadonlySet<string> = new Set(),
): Map<string, DataCalendario> {
  const casosDeProposito = new Map(
    PROXIMAS_VISITAS_DEMO.map(({ nomeFantasia, diasAFrente }): [string, DataCalendario] => {
      const data = somarDias(hoje, diasAFrente);
      return [cnpjDoCliente(nomeFantasia), diasAFrente > 0 ? proximoDiaUtil(data) : data];
    }),
  );
  const inativos = new Set(CLIENTES.filter((cliente) => cliente.ativo === false).map((cliente) => cliente.cnpj));
  const ativos = clientesDaDemonstracao().filter((cliente) => !inativos.has(cliente.cnpj));
  const escolhidas = escolherVisitasMarcadas(hoje, ativos, JANELA_DAS_VISITAS_MARCADAS, {
    jaMarcadas: casosDeProposito,
    visitadosHoje,
  });
  return new Map([...casosDeProposito, ...escolhidas]);
}

type LembreteSeed = {
  nomeFantasia: string;
  diasAFrente: number;
  concluido?: boolean;
};

/**
 * Lembretes, criados pelo dono da carteira: para cada representante, três
 * abertos (um vencido) e um concluído. O texto segue a última visita do
 * cliente (`textoDoLembrete`); o concluído é o envio do catálogo da campanha.
 */
const LEMBRETES_DEMO: LembreteSeed[] = [
  // Rafael: vencido há 3 dias, +2 e +9; concluído o catálogo do Café Blumenau.
  { nomeFantasia: 'Café Blumenau', diasAFrente: 2 },
  { nomeFantasia: 'Empório do Vale Brusque', diasAFrente: -3 },
  { nomeFantasia: 'Mercearia Alto Vale', diasAFrente: 9 },
  { nomeFantasia: 'Café Blumenau', diasAFrente: -5, concluido: true },
  // Eduarda: vencido ontem (o Mercado Central, atrasado), +1 e +6; concluído o catálogo do Armazém.
  { nomeFantasia: 'Mercado Central Joinville', diasAFrente: -1 },
  { nomeFantasia: 'Confeitaria Dona Frida', diasAFrente: 1 },
  { nomeFantasia: 'Empório do Chocolate', diasAFrente: 6 },
  { nomeFantasia: 'Armazém São Bento', diasAFrente: -4, concluido: true },
];

/** Visitas por dia útil na meta mensal (a rota tem de 4 a 6). */
const VISITAS_POR_DIA_UTIL = 5;
/** Meta de vendas: 10 % acima da média mensal do histórico gerado. */
const FATOR_DA_META_DE_VENDAS = 1.1;

function diasUteisEntre(inicio: DataCalendario, fim: DataCalendario): number {
  let uteis = 0;
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) {
    if (diaDaSemana(dia) <= 5) uteis += 1;
  }
  return uteis;
}

function arredondarParaCentena(valor: number): number {
  return Math.round(valor / 100) * 100;
}

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
  await prisma.user.updateMany({
    where: { email: EMAIL_GESTOR_ANTIGO },
    data: { ativo: false },
  });
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

/** `erpId` do cliente da demonstração: o do gerado ou o calibrado dos âncoras (`ERP_IDS_DEMONSTRACAO`). */
function erpIdDoCliente(cliente: Pick<ClienteSeed, 'erpId' | 'nomeFantasia'>): string | null {
  return cliente.erpId !== undefined ? cliente.erpId : (ERP_IDS_DEMONSTRACAO[cliente.nomeFantasia] ?? null);
}

async function seedCliente(
  prisma: Banco,
  cliente: ClienteSeed,
  representantes: Map<string, string>,
  hoje: Date,
): Promise<void> {
  // `agenda` é só da rota (não vai para o banco).
  const {
    contatos,
    representanteEmail,
    recorrenciaDias = 14,
    ativo = true,
    agenda: _agenda,
    erpId: erpIdDoGerado,
    ...cadastro
  } = cliente;
  const representanteId = representantes.get(representanteEmail);
  if (!representanteId) throw new Error(`Representante ${representanteEmail} não existe.`);
  const erpId = erpIdDoCliente({ erpId: erpIdDoGerado, nomeFantasia: cliente.nomeFantasia });
  const dadosCliente = {
    ...cadastro,
    recorrenciaDias,
    ativo,
    representanteId,
    erpId,
  };

  const client = await prisma.client.upsert({
    where: { cnpj: cliente.cnpj },
    update: dadosCliente,
    // `criadoEm` é a base da primeira visita de quem nunca foi visitado.
    create: { ...dadosCliente, criadoEm: hoje },
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
    await prisma.seasonalEvent.upsert({
      where: { nome },
      update: dados,
      create: evento,
    });
  }
}

type CampanhaGravada = CampanhaSeed & { id: string };

/** Campanhas de demonstração; só cria a que ainda não existe com o mesmo nome. */
async function seedCampanhas(prisma: Banco, hoje: DataCalendario): Promise<CampanhaGravada[]> {
  const gravadas: CampanhaGravada[] = [];

  for (const campanha of campanhasDemo(hoje)) {
    const { inicio, fim, ...dados } = campanha;
    const existente = await prisma.campaign.findFirst({
      where: { nome: campanha.nome },
    });
    const { id } =
      existente ??
      (await prisma.campaign.create({
        data: {
          ...dados,
          inicio: colunaDateDaData(inicio),
          fim: colunaDateDaData(fim),
        },
      }));
    gravadas.push({ ...campanha, id });
  }

  return gravadas;
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

/**
 * Nome e preço do catálogo de demonstração, como o check-in grava. Lido de
 * `CATALOGO` direto (não de `erp.service`), seja qual for o provedor.
 */
function itensDoPedido(visitId: string, itens: readonly ItemGerado[]): Prisma.VisitItemCreateManyInput[] {
  return itens.map(({ sku, quantidade }) => {
    const produto = CATALOGO.find((candidato) => candidato.sku === sku);
    if (!produto) throw new Error(`SKU ${sku} do seed não existe no catálogo de demonstração.`);
    return {
      visitId,
      sku,
      produtoNome: produto.nome,
      quantidade,
      precoUnitario: produto.precoUnitario,
    };
  });
}

type ClienteGravado = {
  id: string;
  representanteId: string;
  contatos: Map<string, string>;
  temVisitas: boolean;
};

/** Clientes da demonstração já no banco, pelo CNPJ: id, dono, contatos (por e-mail) e se já têm visita. */
async function clientesGravados(prisma: Banco): Promise<Map<string, ClienteGravado>> {
  const clientes = await prisma.client.findMany({
    where: { cnpj: { in: CLIENTES.map((cliente) => cliente.cnpj) } },
    include: { contacts: true, _count: { select: { visits: true } } },
  });
  return new Map(
    clientes.map((cliente) => [
      cliente.cnpj,
      {
        id: cliente.id,
        representanteId: cliente.representanteId,
        contatos: new Map(cliente.contacts.map((contato) => [contato.email ?? '', contato.id])),
        temVisitas: cliente._count.visits > 0,
      },
    ]),
  );
}

/**
 * Grava as visitas geradas, em lote. Idempotente por cliente: se o cliente
 * já tem visita registrada, pula (não duplica) — o `semear` não renova
 * visitas; quem renova é o reinício. Venda no período da campanha em
 * andamento, com produto dela, fica vinculada à campanha.
 */
async function seedVisitas(
  prisma: Banco,
  visitas: readonly VisitaGerada[],
  gravados: Map<string, ClienteGravado>,
  campanhaAtual: CampanhaGravada | undefined,
): Promise<void> {
  const dadosDasVisitas: Prisma.VisitCreateManyInput[] = [];
  const dadosDosItens: Prisma.VisitItemCreateManyInput[] = [];

  for (const visita of visitas) {
    const cliente = gravados.get(visita.cnpj);
    if (!cliente || cliente.temVisitas) continue;
    const id = randomUUID();
    const naCampanha =
      campanhaAtual &&
      visita.resultado === 'VENDA' &&
      visita.data >= campanhaAtual.inicio &&
      visita.data <= campanhaAtual.fim &&
      visita.itens.some((item) => campanhaAtual.produtos.includes(item.sku));
    dadosDasVisitas.push({
      id,
      clientId: cliente.id,
      userId: cliente.representanteId,
      contactId: visita.contatoEmail ? (cliente.contatos.get(visita.contatoEmail) ?? null) : null,
      dataHora: visita.dataHora,
      descricao: visita.descricao,
      resultado: visita.resultado,
      campanhaId: naCampanha ? campanhaAtual.id : null,
    });
    dadosDosItens.push(...itensDoPedido(id, visita.itens));
  }

  await prisma.visit.createMany({ data: dadosDasVisitas });
  await prisma.visitItem.createMany({ data: dadosDosItens });
}

/**
 * Grava as próximas visitas marcadas (`visitasMarcadasDaDemonstracao`), uma
 * gravação por dia. Só marca cliente que ainda não tem uma (não sobrescreve
 * check-in do app): idempotente. Só o Empório do Vale Brusque, adiante, leva
 * a campanha vigente na data.
 */
async function seedProximasVisitas(
  prisma: Banco,
  hoje: DataCalendario,
  campanhas: CampanhaGravada[],
  visitas: readonly VisitaGerada[],
): Promise<void> {
  const visitadosHoje = new Set(visitas.filter((visita) => visita.data === hoje).map((visita) => visita.cnpj));
  const marcadas = visitasMarcadasDaDemonstracao(hoje, visitadosHoje);
  const comCampanha = cnpjDoCliente(MARCADA_COM_CAMPANHA);

  const porDia = new Map<DataCalendario, string[]>();
  for (const [cnpj, data] of marcadas) {
    if (cnpj === comCampanha) continue;
    porDia.set(data, [...(porDia.get(data) ?? []), cnpj]);
  }
  for (const [data, cnpjs] of porDia) {
    await prisma.client.updateMany({
      where: { cnpj: { in: cnpjs }, proximaVisita: null },
      data: { proximaVisita: colunaDateDaData(data), proximaCampanhaId: null },
    });
  }

  const dataDaCampanha = marcadas.get(comCampanha);
  if (dataDaCampanha) {
    const campanha = campanhas.find(({ inicio, fim }) => inicio <= dataDaCampanha && dataDaCampanha <= fim);
    await prisma.client.updateMany({
      where: { cnpj: comCampanha, proximaVisita: null },
      data: { proximaVisita: colunaDateDaData(dataDaCampanha), proximaCampanhaId: campanha?.id ?? null },
    });
  }
}

/**
 * Dia do lembrete `diasAFrente` dias depois de `hoje`, sempre em dia útil: o
 * vencido (negativo) recua para o dia útil anterior, o futuro avança para o
 * próximo; o de hoje (0) fica como está.
 */
function dataDoLembrete(hoje: DataCalendario, diasAFrente: number): DataCalendario {
  const data = somarDias(hoje, diasAFrente);
  if (diasAFrente < 0) return diaUtilAnterior(data);
  if (diasAFrente > 0) return proximoDiaUtil(data);
  return data;
}

/**
 * Só cria o lembrete que ainda não existe (mesmo cliente e texto, aberto ou
 * concluído), pelo dono da carteira; o concluído fica concluído `hoje`. O
 * texto segue a última visita gerada do cliente.
 */
async function seedLembretes(
  prisma: Banco,
  hoje: Date,
  visitas: readonly VisitaGerada[],
  gravados: Map<string, ClienteGravado>,
  campanhaAtual: CampanhaGravada | undefined,
): Promise<void> {
  const dia = dataCalendario(hoje);

  for (const { nomeFantasia, diasAFrente, concluido } of LEMBRETES_DEMO) {
    const cliente = CLIENTES.find((candidato) => candidato.nomeFantasia === nomeFantasia);
    const gravado = cliente && gravados.get(cliente.cnpj);
    if (!cliente || !gravado) continue;

    const ultima = visitas.filter((visita) => visita.cnpj === cliente.cnpj).at(-1);
    const contato =
      cliente.contatos.find((candidato) => candidato.email === ultima?.contatoEmail) ?? cliente.contatos[0] ?? null;
    const nomeDaCampanha = campanhaAtual?.nome ?? 'do mês';
    const texto = concluido
      ? `Enviar o catálogo da campanha ${nomeDaCampanha} por e-mail para ${contato?.nome.split(' ')[0] ?? 'a responsável'}.`
      : textoDoLembrete(
          ultima?.resultado ?? 'SEM_VENDA',
          contato,
          ultima?.itens[0]?.sku ?? campanhaAtual?.produtos[0] ?? 'BOMB-SORT',
          nomeDaCampanha,
        );

    const existente = await prisma.reminder.findFirst({
      where: { clientId: gravado.id, texto },
    });
    if (existente) continue;

    await prisma.reminder.create({
      data: {
        clientId: gravado.id,
        criadoPorId: gravado.representanteId,
        texto,
        data: colunaDateDaData(dataDoLembrete(dia, diasAFrente)),
        concluidoEm: concluido ? hoje : null,
      },
    });
  }
}

/** Mensagens de estoque do seed por representante. */
const MENSAGENS_DE_ESTOQUE_POR_REPRESENTANTE = 3;
/** Dias úteis antes de `hoje` de cada mensagem (a mais recente primeiro); o 2º representante, um dia útil a mais. */
const DIAS_UTEIS_ATRAS_DAS_MENSAGENS = [2, 8, 15] as const;
const MILISSEGUNDOS_POR_MINUTO = 60_000;

/** O dia útil `quantos` dias úteis antes de `dia`. */
function diasUteisAntes(dia: DataCalendario, quantos: number): DataCalendario {
  let data = dia;
  for (let contados = 0; contados < quantos; ) {
    data = somarDias(data, -1);
    if (diaDaSemana(data) <= 5) contados += 1;
  }
  return data;
}

/**
 * Instante da `indice`-ésima mensagem do representante de posição
 * `posicaoDoRepresentante`: num dia útil das últimas 4 semanas (de 2 a 16
 * dias úteis antes de `hoje`), entre 9h e 15h de São Paulo; determinístico
 * por `hoje`.
 */
function dataDaMensagem(hoje: DataCalendario, posicaoDoRepresentante: number, indice: number): Date {
  const dia = diasUteisAntes(hoje, (DIAS_UTEIS_ATRAS_DAS_MENSAGENS[indice] as number) + posicaoDoRepresentante);
  const minutos = 9 * 60 + ((indice * 137 + posicaoDoRepresentante * 71) % (6 * 60));
  return new Date(inicioDoDia(dia).getTime() + minutos * MILISSEGUNDOS_POR_MINUTO);
}

/**
 * Mensagens de estoque (UC12) para a aba "Mensagens geradas" e a taxa de
 * registro do painel: para cada representante, uma para cada um dos 3
 * clientes ativos com `erpId` de venda mais recente nas visitas geradas, em
 * dias úteis das últimas 4 semanas (`dataDaMensagem`). O texto é o da regra
 * real (`montarMensagemDeEstoque`), para o contato principal, com o nome do
 * representante e o evento sazonal vigente na data (`eventoVigente`, pela
 * transação), que também vai em `eventoSazonalId`. Não consulta o ERP: o
 * template não usa estoque. Idempotente: pula a mensagem que já existe para o
 * cliente na mesma `dataGeracao`.
 */
async function seedMensagensDeEstoque(
  prisma: Banco,
  hoje: DataCalendario,
  visitas: readonly VisitaGerada[],
  gravados: Map<string, ClienteGravado>,
  usuarios: readonly { id: string; nome: string; email: string }[],
): Promise<void> {
  const elegiveis = new Map(
    CLIENTES.filter((cliente) => cliente.ativo !== false && erpIdDoCliente(cliente) !== null).map((cliente) => [
      cliente.cnpj,
      cliente,
    ]),
  );
  const vendasRecentes = visitas
    .filter((visita) => visita.resultado === 'VENDA' && elegiveis.has(visita.cnpj))
    .sort((a, b) => b.dataHora.getTime() - a.dataHora.getTime());

  for (const [posicao, email] of [EMAIL_EDUARDA, EMAIL_RAFAEL].entries()) {
    const representante = usuarios.find((usuario) => usuario.email === email);
    if (!representante) continue;
    const cnpjs = [
      ...new Set(vendasRecentes.filter((visita) => visita.representanteEmail === email).map((visita) => visita.cnpj)),
    ].slice(0, MENSAGENS_DE_ESTOQUE_POR_REPRESENTANTE);

    for (const [indice, cnpj] of cnpjs.entries()) {
      const cliente = elegiveis.get(cnpj) as ClienteSeed;
      const gravado = gravados.get(cnpj);
      if (!gravado) continue;
      const dataGeracao = dataDaMensagem(hoje, posicao, indice);
      const existente = await prisma.stockMessage.findFirst({ where: { clientId: gravado.id, dataGeracao } });
      if (existente) continue;

      const evento = await eventoVigente(dataGeracao, prisma);
      const principal = cliente.contatos.find((contato) => contato.principal) ?? cliente.contatos[0] ?? null;
      const textoFinal = montarMensagemDeEstoque({
        nomeContato: principal?.nome ?? null,
        nomeFantasia: cliente.nomeFantasia,
        nomeRepresentante: representante.nome,
        evento: evento
          ? { nome: nomeDoEventoNoTemplate(evento.nome), produtosSugeridos: evento.produtosSugeridos }
          : null,
      });
      await prisma.stockMessage.create({
        data: {
          clientId: gravado.id,
          userId: representante.id,
          eventoSazonalId: evento?.id ?? null,
          textoFinal,
          dataGeracao,
        },
      });
    }
  }
}

type MetaSeed = {
  representanteEmail: string;
  metaVisitas: number;
  metaVendas: number;
  /** Período da meta: o mês (mensal) ou o da campanha. */
  inicio: DataCalendario;
  fim: DataCalendario;
  campanha?: CampanhaGravada;
};

/**
 * Metas compatíveis com o ritmo gerado: a mensal de cada representante, do
 * mês de `hoje` e do mês seguinte, pede `VISITAS_POR_DIA_UTIL` visitas por
 * dia útil do mês e vendas 10 % acima da média mensal do histórico gerado; a
 * da campanha em andamento (Eduarda), duas visitas por dia útil e 35 % dessa
 * média.
 */
function metasDemo(
  hoje: Date,
  visitas: readonly VisitaGerada[],
  campanhaAtual: CampanhaGravada | undefined,
): MetaSeed[] {
  const doMes = periodoDaMeta('MENSAL', dataCalendario(hoje));
  const doSeguinte = periodoDaMeta('MENSAL', somarDias(doMes.fim, 1));
  const media = (email: string): number => mediaMensalDeVendas(visitas, email, hoje);
  const metas: MetaSeed[] = [doMes, doSeguinte].flatMap(({ inicio, fim }) =>
    [EMAIL_EDUARDA, EMAIL_RAFAEL].map((representanteEmail) => ({
      representanteEmail,
      metaVisitas: diasUteisEntre(inicio, fim) * VISITAS_POR_DIA_UTIL,
      metaVendas: arredondarParaCentena(media(representanteEmail) * FATOR_DA_META_DE_VENDAS),
      inicio,
      fim,
    })),
  );
  if (campanhaAtual) {
    metas.push({
      representanteEmail: EMAIL_EDUARDA,
      metaVisitas: diasUteisEntre(campanhaAtual.inicio, campanhaAtual.fim) * 2,
      metaVendas: arredondarParaCentena(media(EMAIL_EDUARDA) * 0.35),
      inicio: campanhaAtual.inicio,
      fim: campanhaAtual.fim,
      campanha: campanhaAtual,
    });
  }
  return metas;
}

/** Só cria a meta que ainda não existe (mesmo representante, período, início, fim e campanha). */
async function seedMetas(prisma: Banco, metas: readonly MetaSeed[], representantes: Map<string, string>): Promise<void> {
  for (const { representanteEmail, metaVisitas, metaVendas, inicio, fim, campanha } of metas) {
    const representanteId = representantes.get(representanteEmail) as string;
    const dados = {
      representanteId,
      periodo: campanha ? ('CAMPANHA' as const) : ('MENSAL' as const),
      inicio: colunaDateDaData(inicio),
      fim: colunaDateDaData(fim),
      campanhaId: campanha?.id ?? null,
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
 * gestor, inativa) e cria o que falta — eventos sazonais, produtos de
 * demonstração no catálogo importado (`ErpProduct`, upsert pelo código),
 * campanhas pelo nome, visitas geradas em cliente ainda sem visita, próxima
 * visita em cliente sem uma, lembretes, mensagens de estoque e metas que não
 * existem. Não apaga nada.
 */
export async function semear(prisma: Banco, hoje: Date): Promise<void> {
  const dia = dataCalendario(hoje);
  const visitas = gerarVisitas(hoje, clientesDaDemonstracao());

  await seedUsuarios(prisma);
  const usuarios = await prisma.user.findMany({
    where: { email: { in: [EMAIL_EDUARDA, EMAIL_RAFAEL] } },
  });
  const representantes = new Map(usuarios.map((usuario) => [usuario.email, usuario.id]));
  for (const cliente of CLIENTES) {
    await seedCliente(prisma, cliente, representantes, hoje);
  }
  await seedEventosSazonais(prisma, dia);
  await seedProdutos(prisma);
  const campanhas = await seedCampanhas(prisma, dia);
  const campanhaAtual = campanhas[0];
  const gravados = await clientesGravados(prisma);
  await seedVisitas(prisma, visitas, gravados, campanhaAtual);
  await seedProximasVisitas(prisma, dia, campanhas, visitas);
  await seedLembretes(prisma, hoje, visitas, gravados, campanhaAtual);
  await seedMensagensDeEstoque(prisma, dia, visitas, gravados, usuarios);
  await seedMetas(prisma, metasDemo(hoje, visitas, campanhaAtual), representantes);
}

/**
 * Depois de recriar os clientes: liga cada nota sem cliente ao cliente de mesmo
 * CNPJ (quando existe) e marca as que seguem sem cliente como `SEM_CLIENTE`.
 */
async function religarNotasOrfas(tx: Banco): Promise<void> {
  const orfas = await tx.erpSale.findMany({
    where: { clientId: null },
    select: { destinatarioCnpj: true },
    distinct: ['destinatarioCnpj'],
  });
  const cnpjs = orfas.map((nota) => nota.destinatarioCnpj);
  const clientes = await tx.client.findMany({ where: { cnpj: { in: cnpjs } }, select: { id: true, cnpj: true } });
  for (const cliente of clientes) {
    await tx.erpSale.updateMany({
      where: { clientId: null, destinatarioCnpj: cliente.cnpj },
      data: { clientId: cliente.id },
    });
    // A nota que estava "sem cliente" e ganhou cliente volta a "só no ERP, sem visita".
    await tx.erpSale.updateMany({
      where: { clientId: cliente.id, vinculoStatus: 'SEM_CLIENTE' },
      data: { vinculoStatus: 'SEM_VISITA' },
    });
  }
  await tx.erpSale.updateMany({
    where: { clientId: null },
    data: { vinculoStatus: 'SEM_CLIENTE', visitaSugeridaId: null },
  });
}

/**
 * Renova a demonstração (`npm run db:seed:reset` ou o "Modo demonstração" da
 * tela de login), numa transação só: se algo falhar no meio (inclusive no
 * `semear`), nada é apagado. Só os clientes da demonstração (CNPJ em
 * `cnpjsDaDemonstracao()`) são apagados e recriados, com o que é deles —
 * inclusive o que o app gravou neles; o cliente real (outro CNPJ, cadastrado
 * à mão ou pela nota fiscal) fica com contatos, visitas e itens, lembretes,
 * mensagens de estoque, mudanças de recorrência e notas vinculadas. Apaga,
 * nesta ordem (quem depende antes de quem é referenciado): metas (todas),
 * lembretes, itens de pedido, visitas, mensagens de estoque, mudanças de
 * recorrência e contatos dos clientes da demonstração, esses clientes e as
 * campanhas (todas: a visita e a próxima visita do cliente real só perdem a
 * campanha, pelo `SetNull`). Recria tudo com `semear`, com datas relativas a
 * `hoje`. Os representantes de demonstração voltam à senha de demonstração e
 * ficam ativos; a conta Gestão (conta real) fica ativa e mantém a senha dela;
 * a conta antiga do gestor fica inativa; os demais usuários (criados pelo
 * app) ficam intactos, com a senha deles. Os eventos sazonais não são
 * apagados (o upsert os mantém em dia). Nada do ERP importado é apagado —
 * notas, importações e produtos (`ErpProduct`) ficam; os produtos de
 * demonstração voltam ao nome e preço do catálogo pelo upsert. Antes de
 * apagar as visitas, as notas sem cliente ou de cliente da demonstração que
 * estavam vinculadas (`AUTOMATICO`, `VINCULADA`) ou pendentes voltam a
 * `SEM_VISITA`, sem visita sugerida: a visita delas some, e uma reimportação
 * decide o vínculo de novo; as do cliente real ficam como estão (a visita
 * dele não some). As `RECUSADA` ficam como estão. Apagar os clientes da
 * demonstração deixa as notas deles sem cliente (`SetNull`); no fim da
 * transação, depois do `semear`, a nota cujo CNPJ voltou a ter cliente é
 * religada a ele (segue alimentando a ficha, pela regra do híbrido) e a que
 * continua sem cliente vira `SEM_CLIENTE`, sem visita sugerida, para aparecer
 * em "CNPJs sem cliente no CRM".
 */
export async function reiniciarDemonstracao(prisma: PrismaClient, hoje: Date): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const demonstracao = await tx.client.findMany({
        where: { cnpj: { in: [...cnpjsDaDemonstracao()] } },
        select: { id: true },
      });
      const idsDemo = demonstracao.map((cliente) => cliente.id);
      const doCliente = { clientId: { in: idsDemo } };

      await tx.goal.deleteMany();
      await tx.reminder.deleteMany({ where: doCliente });
      await tx.erpSale.updateMany({
        where: {
          vinculoStatus: { in: ['AUTOMATICO', 'VINCULADA', 'PENDENTE'] },
          OR: [{ clientId: null }, doCliente],
        },
        data: { vinculoStatus: 'SEM_VISITA', visitaSugeridaId: null },
      });
      await tx.visitItem.deleteMany({ where: { visit: doCliente } });
      await tx.visit.deleteMany({ where: doCliente });
      await tx.stockMessage.deleteMany({ where: doCliente });
      await tx.visitScheduleChange.deleteMany({ where: doCliente });
      await tx.contact.deleteMany({ where: doCliente });
      await tx.client.deleteMany({ where: { id: { in: idsDemo } } });
      await tx.campaign.deleteMany();

      await semear(tx, hoje);
      await religarNotasOrfas(tx);
    },
    { timeout: PRAZO_DA_TRANSACAO_MS, maxWait: 10_000 },
  );
}
