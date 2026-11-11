import type { ResultadoVisita } from '@prisma/client';
import type { TipoDeCliente } from './clientes-gerados';

/**
 * Banco de frases das anotações de visita da demonstração, na voz do
 * representante: abertura (com o nome e o cargo do contato, pela situação),
 * observação do negócio (pelo tipo de cliente), o pedido (nas vendas) ou um
 * gancho da época (pela estação do mês) e o fechamento (pela situação).
 *
 * Sem repetição em sequência no mesmo cliente: a abertura é escolhida pelo
 * número de ordem absoluto da visita na rota (`ordemDaVisita`), e visitas
 * consecutivas têm números consecutivos — duas seguidas com a mesma situação
 * caem em aberturas diferentes, e com situações diferentes vêm de bancos
 * diferentes. O resto da frase vem do sorteio determinístico da visita.
 */

export type Estacao = 'verao' | 'pascoa' | 'maes' | 'inverno' | 'oktoberfest' | 'natal';

const ESTACAO_DO_MES: Record<number, Estacao> = {
  1: 'verao',
  2: 'pascoa',
  3: 'pascoa',
  4: 'pascoa',
  5: 'maes',
  6: 'inverno',
  7: 'inverno',
  8: 'inverno',
  9: 'oktoberfest',
  10: 'oktoberfest',
  11: 'natal',
  12: 'natal',
};

export function estacaoDoMes(mes: number): Estacao {
  return ESTACAO_DO_MES[mes] ?? 'verao';
}

const ABERTURAS: Record<ResultadoVisita, readonly string[]> = {
  VENDA: [
    'Atendimento com {nome}, {cargo}.',
    '{nome}, {cargo}, já tinha a lista pronta quando cheguei.',
    'Conversei com {nome} ({cargo}) logo na chegada.',
    '{nome} ({cargo}) conferiu o estoque comigo antes do pedido.',
    'Visita rápida com {nome} ({cargo}), que fechou a reposição na hora.',
  ],
  NEGOCIACAO: [
    '{nome} ({cargo}) gostou da proposta, mas quer comparar com o último pedido.',
    'Conversei com {nome} ({cargo}), que ficou de fechar as quantidades até o fim da semana.',
    '{nome} ({cargo}) pediu um prazo de pagamento maior para fechar.',
    'Apresentei a linha da época para {nome} ({cargo}), que vai decidir com a sociedade.',
  ],
  SEM_VENDA: [
    '{nome} ({cargo}) disse que o estoque ainda está alto.',
    'Falei com {nome} ({cargo}): o movimento caiu e não quis repor agora.',
    '{nome} ({cargo}) estava sem tempo; só conferi a exposição no balcão.',
    '{nome} ({cargo}) vai esperar o fechamento do mês para o próximo pedido.',
  ],
};

const OBSERVACOES: Record<TipoDeCliente, readonly string[]> = {
  padaria: [
    'O expositor do caixa estava quase vazio.',
    'Os tabletes giram bem junto com o café da manhã.',
    'Pediram sugestão de cobertura para os doces da vitrine.',
  ],
  cafe: [
    'As trufas do balcão saem muito com o expresso.',
    'O movimento da tarde aumentou com o cardápio novo.',
    'Querem um mimo de chocolate para servir com o café.',
  ],
  confeitaria: [
    'Usam a barra 70% na cobertura das tortas.',
    'As encomendas de festa aumentaram neste mês.',
    'A vitrine de bombons continua sendo o ponto forte da casa.',
  ],
  emporio: [
    'A gôndola de chocolates finos ficou bem posicionada na entrada.',
    'Os turistas procuram presentes da região.',
    'Os clientes perguntam pelo percentual de cacau no rótulo.',
  ],
  mercearia: [
    'Os tabletes ao leite seguem como os mais vendidos do corredor.',
    'O encarte da semana trouxe os chocolates na ponta de gôndola.',
    'Os dragées do caixa rápido giram toda semana.',
  ],
  casaDeCha: [
    'O café colonial do fim de semana puxa a venda de trufas.',
    'As mesas pedem bombons para acompanhar o chá.',
    'Os grupos de excursão aumentaram o movimento.',
  ],
  hotel: [
    'As caixas presente vão para a amenidade dos quartos.',
    'O restaurante do hotel usa bombons na sobremesa.',
    'A ocupação está alta com os eventos da região.',
  ],
  restaurante: [
    'O petit gâteau com a barra 70% virou o carro-chefe das sobremesas.',
    'Servem um bombom de cortesia junto com a conta.',
    'O cardápio de sobremesas foi renovado.',
  ],
  presentes: [
    'As caixas presente vendem bem nas datas comemorativas.',
    'A vitrine temática chama a atenção de quem passa.',
    'Os clientes pedem embalagem para presente.',
  ],
};

/** Gancho da época: `positivo` nas vendas, `pendente` nas negociações e visitas sem venda. */
const GANCHOS: Record<Estacao, { positivo: readonly string[]; pendente: readonly string[] }> = {
  verao: {
    positivo: ['No calor, preferem os dragées, que aguentam melhor a vitrine.', 'O movimento de férias ajudou o giro.'],
    pendente: [
      'Com o calor, querem esperar para repor os chocolates da vitrine.',
      'Depois das férias, o movimento ainda não voltou.',
    ],
  },
  pascoa: {
    positivo: ['Já reservaram espaço para os ovos de Páscoa.', 'Perguntaram pelos ovos de Páscoa da linha nova.'],
    pendente: [
      'Vão definir a encomenda de Páscoa depois de ver a tabela.',
      'Ainda estão comparando os ovos de Páscoa com outro fornecedor.',
    ],
  },
  maes: {
    positivo: [
      'A procura por caixas presente para o Dia das Mães começou.',
      'As caixas do Dia das Mães ganharam a vitrine.',
    ],
    pendente: [
      'Estão montando a vitrine do Dia das Mães e decidem as caixas depois.',
      'Querem ver o movimento do Dia das Mães antes de pedir mais.',
    ],
  },
  inverno: {
    positivo: ['No frio, a barra 70% sai para chocolate quente.', 'O inverno aumentou a procura por chocolate quente.'],
    pendente: [
      'Querem testar o chocolate quente de inverno antes de pedir mais.',
      'O frio ainda não trouxe o movimento esperado.',
    ],
  },
  oktoberfest: {
    positivo: [
      'A Oktoberfest trouxe movimento e os pães de mel saíram bem.',
      'Os turistas da Oktoberfest levaram muitos pães de mel.',
    ],
    pendente: [
      'Esperam o movimento da Oktoberfest para decidir a reposição.',
      'Vão rever o pedido depois da Oktoberfest.',
    ],
  },
  natal: {
    positivo: [
      'Já pensam nas caixas de Natal para os clientes de empresas.',
      'A vitrine de Natal está pronta e as caixas presente saíram bem.',
    ],
    pendente: [
      'Estão fechando as encomendas de Natal e pediram a tabela das caixas presente.',
      'Vão fechar o pedido de Natal depois de rever as vendas do ano passado.',
    ],
  },
};

const FECHAMENTOS: Record<ResultadoVisita, readonly string[]> = {
  VENDA: [
    'Entrega combinada para a próxima semana.',
    'Pedido enviado para o faturamento.',
    'Deixei material de ponto de venda.',
    'Próxima visita na data da rota.',
  ],
  NEGOCIACAO: [
    'Retorno pelo WhatsApp em dois dias.',
    'Fico de mandar a tabela atualizada.',
    'Volto na próxima rota para fechar.',
  ],
  SEM_VENDA: ['Volto na próxima rota.', 'Deixei o catálogo atualizado.', 'Combinei de ligar antes da próxima visita.'],
};

/** Como o representante escreve cada produto no pedido (plural da unidade de venda). */
export const PRODUTO_NA_ANOTACAO: Record<string, string> = {
  'TRUF-70': 'caixas de trufas 70%',
  'BARRA-70': 'barras 70%',
  'BOMB-SORT': 'caixas de bombons sortidos',
  'OVO-PASCOA': 'ovos de Páscoa',
  'CX-PRESENTE': 'caixas presente',
  'PAO-MEL': 'pães de mel',
  DRAGEE: 'pacotes de dragées',
  'TAB-LEITE': 'tabletes ao leite',
};

export type ItemDaAnotacao = { sku: string; quantidade: number };

export type DadosDaAnotacao = {
  tipo: TipoDeCliente;
  resultado: ResultadoVisita;
  contato: { nome: string; cargo: string } | null;
  itens: readonly ItemDaAnotacao[];
  mes: number;
  /** Número de ordem absoluto da visita na rota do cliente. */
  ordem: number;
  /** Deslocamento fixo do cliente no banco de aberturas (clientes do mesmo dia não começam todos igual). */
  deslocamento: number;
  /** Sorteio determinístico da visita (cliente + data). */
  sorteio: () => number;
};

function sortear<T>(lista: readonly T[], sorteio: () => number): T {
  return lista[Math.floor(sorteio() * lista.length)] as T;
}

function listaEmPortugues(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** Primeiro nome e cargo em minúsculas, como se escreve no meio da frase ("Roberto (gerente de compras)"). */
function apresentar(modelo: string, contato: { nome: string; cargo: string } | null): string {
  const nome = contato?.nome.split(' ')[0] ?? 'A responsável';
  const cargo = contato
    ? contato.cargo.toLowerCase().replace('a&b', 'A&B')
    : 'loja';
  return modelo.replace('{nome}', nome).replace('{cargo}', cargo);
}

export function anotacaoDaVisita(dados: DadosDaAnotacao): string {
  const { tipo, resultado, contato, itens, mes, ordem, deslocamento, sorteio } = dados;
  const aberturas = ABERTURAS[resultado];
  const abertura = apresentar(
    aberturas[(((ordem + deslocamento) % aberturas.length) + aberturas.length) % aberturas.length] as string,
    contato,
  );
  const observacao = sortear(OBSERVACOES[tipo], sorteio);
  const ganchos = GANCHOS[estacaoDoMes(mes)];
  const meio =
    resultado === 'VENDA'
      ? `Pedido de ${listaEmPortugues(itens.map(({ sku, quantidade }) => `${quantidade} ${PRODUTO_NA_ANOTACAO[sku] ?? sku}`))}.`
      : sortear(ganchos.pendente, sorteio);
  const fechamento = sortear(FECHAMENTOS[resultado], sorteio);
  const extra = resultado === 'VENDA' && sorteio() < 0.5 ? ` ${sortear(ganchos.positivo, sorteio)}` : '';
  return `${abertura} ${observacao} ${meio}${extra} ${fechamento}`;
}

/**
 * Texto do lembrete, coerente com a última visita do cliente: depois de uma
 * venda, conferir o giro; de uma negociação, voltar com a proposta da
 * campanha; de uma visita sem venda, ligar antes da próxima rota.
 */
export function textoDoLembrete(
  resultado: ResultadoVisita,
  contato: { nome: string } | null,
  produtoSku: string,
  campanha: string,
): string {
  const nome = contato?.nome.split(' ')[0] ?? 'a responsável';
  const produto = PRODUTO_NA_ANOTACAO[produtoSku] ?? 'produtos';
  if (resultado === 'VENDA') {
    const artigo = /^(pães|pacotes|tabletes|ovos)/.test(produto) ? 'dos' : 'das';
    return `Conferir com ${nome} o giro ${artigo} ${produto} e sugerir a reposição.`;
  }
  if (resultado === 'NEGOCIACAO') return `Retornar para ${nome} com a proposta de ${produto} da campanha ${campanha}.`;
  return `Ligar para ${nome} e ver se o estoque baixou antes da próxima rota.`;
}
