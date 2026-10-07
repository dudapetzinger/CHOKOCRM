import type { SeasonalEvent } from '@prisma/client';
import {
  DIAS_DE_BASE,
  JANELA_PICO_DIAS,
  LIMIAR_VARIACAO_ALTA,
  LIMIAR_VARIACAO_BAIXA,
  NOME_DO_EVENTO,
  SKUS_SUGERIDOS,
  dataDoEvento,
  type EventoSazonal,
} from '../config/sazonalidade';
import type { Sale } from '../providers/erp/ErpProvider';
import { dataCalendario, diasEntre, somarDias, type DataCalendario } from './classificacao.service';
import type { ItemBaixo } from './erp.service';
import { listarProdutos } from './stock-message.template';

/**
 * Regras puras de insights sazonais (UC13) e alertas de produção (UC15) —
 * mesmo papel de `agenda.montagem.ts`: nenhuma dependência de banco, de
 * `env` nem da instância do provedor de ERP (só tipos, importados com
 * `import type`), para que o teste unitário rode sem `DATABASE_URL`. Quem
 * busca os dados (`insights.service.ts`) importa daqui, nunca o contrário.
 */
export type AcaoSugerida = 'AUMENTAR_OFERTA' | 'CRIAR_PROMOCAO' | 'OFERTAR_DESCONTO';

export type EventoProximo = {
  id: string;
  nome: string;
  chave: EventoSazonal;
  /** `dataFim` do evento no banco (coluna `@db.Date`, meia-noite UTC) como data de calendário. */
  dataEvento: DataCalendario;
  /** `diasEntre(hoje, dataEvento)`; nunca negativo. */
  diasAteEvento: number;
  produtosSugeridos: string[];
};

export type Janela = { inicio: DataCalendario; fim: DataCalendario };

export type AlertaProducao = {
  evento: { id: string; nome: string; dataEvento: DataCalendario; diasAteEvento: number };
  produto: { sku: string; nome: string };
  clientes: { id: string; nomeFantasia: string; cidade: string; quantidade: number; atualizadoEm: string }[];
};

export type ClienteComEstoque = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  itensBaixos: ItemBaixo[];
};

/**
 * `SeasonalEvent` com a `chave` que liga o registro ao calendário de
 * `config/sazonalidade.ts`. Tipo estrutural: o `SeasonalEvent` gerado pelo
 * Prisma o satisfaz assim que a coluna `chave` existir no schema.
 */
export type EventoDoBanco = Pick<SeasonalEvent, 'id' | 'nome' | 'dataFim' | 'produtosSugeridos'> & {
  chave: EventoSazonal;
};

/** Datas `AAAA-MM-DD` comparam como texto na mesma ordem em que comparam como calendário. */
function dentroDaJanela(dia: DataCalendario, janela: Janela): boolean {
  return dia >= janela.inicio && dia <= janela.fim;
}

/**
 * Eventos com `dataFim` em `[hoje, hoje + horizonteDias]` (limites
 * inclusivos), ordenados por data crescente. Evento de hoje tem
 * `diasAteEvento` 0; evento passado fica de fora.
 */
export function eventosNoHorizonte(
  eventos: EventoDoBanco[],
  hoje: DataCalendario,
  horizonteDias: number,
): EventoProximo[] {
  return eventos
    .map((evento): EventoProximo => {
      const dataEvento = evento.dataFim.toISOString().slice(0, 10);

      return {
        id: evento.id,
        nome: evento.nome,
        chave: evento.chave,
        dataEvento,
        diasAteEvento: diasEntre(hoje, dataEvento),
        produtosSugeridos: evento.produtosSugeridos,
      };
    })
    .filter((evento) => evento.diasAteEvento >= 0 && evento.diasAteEvento <= horizonteDias)
    .sort((a, b) => a.diasAteEvento - b.diasAteEvento);
}

/**
 * Janela de pico do mesmo evento no ano anterior: com `D'` =
 * `dataDoEvento(chave, anoDoEvento − 1)`, `[D' − JANELA_PICO_DIAS, D']` —
 * mesma convenção de `dataInicio`/`dataFim` do `SeasonalEvent`. Calculada a
 * partir da data real do evento no ano anterior, e não deslocando a janela
 * deste ano, porque a Páscoa muda até cinco semanas de um ano para o outro.
 */
export function janelaDoAnoAnterior(chave: EventoSazonal, anoDoEvento: number): Janela {
  const dataNoAnoAnterior = dataDoEvento(chave, anoDoEvento - 1);

  return { inicio: somarDias(dataNoAnoAnterior, -JANELA_PICO_DIAS), fim: dataNoAnoAnterior };
}

/** Os `DIAS_DE_BASE` dias imediatamente anteriores à janela: `[janela.inicio − DIAS_DE_BASE, janela.inicio − 1]`. */
export function periodoBase(janela: Janela): Janela {
  return { inicio: somarDias(janela.inicio, -DIAS_DE_BASE), fim: somarDias(janela.inicio, -1) };
}

/**
 * Vendas cuja data de calendário (no fuso do negócio) cai na janela, limites
 * inclusivos, na ordem recebida — o mesmo recorte de `totalNaJanela`, para
 * quem precisa das vendas em si (ex.: produtos mais comprados na janela).
 */
export function vendasNaJanela(vendas: Sale[], janela: Janela): Sale[] {
  return vendas.filter((venda) => dentroDaJanela(dataCalendario(venda.data), janela));
}

/** Soma de `valor` das vendas cuja data de calendário (no fuso do negócio) cai na janela, limites inclusivos. */
export function totalNaJanela(vendas: Sale[], janela: Janela): number {
  return vendasNaJanela(vendas, janela).reduce((total, venda) => total + venda.valor, 0);
}

/**
 * Quanto o cliente compraria em `diasJanela` dias no ritmo do período de
 * base: `totalBase × diasJanela / DIAS_DE_BASE`. É a régua de
 * `calcularVariacao` e também o valor exibido na sugestão — uma única conta
 * para os dois não divergirem.
 */
export function mediaNaJanela(totalBase: number, diasJanela: number): number {
  return (totalBase * diasJanela) / DIAS_DE_BASE;
}

/**
 * Variação das compras na janela sobre a média do cliente no período de
 * base: `variação = totalJanela / mediaNaJanela − 1` (0,85 = +85%).
 * `diasJanela` conta a janela inclusiva (31 dias para uma janela de 30 dias
 * antes do evento mais o próprio dia). Devolve `null` sem base
 * (`totalBase` = 0) ou sem compra na janela (`totalJanela` = 0) — UC13 A1.
 */
export function calcularVariacao(totalJanela: number, totalBase: number, diasJanela: number): number | null {
  if (totalBase === 0 || totalJanela === 0) {
    return null;
  }

  return totalJanela / mediaNaJanela(totalBase, diasJanela) - 1;
}

/**
 * `variacao ≥ LIMIAR_VARIACAO_ALTA` → AUMENTAR_OFERTA; `≤ LIMIAR_VARIACAO_BAIXA`
 * → OFERTAR_DESCONTO; entre os dois → CRIAR_PROMOCAO. Quem exibe a variação
 * em percentual inteiro deve arredondar antes de chamar, para a ação
 * coincidir com o número mostrado.
 */
export function acaoPorVariacao(variacao: number): AcaoSugerida {
  if (variacao >= LIMIAR_VARIACAO_ALTA) {
    return 'AUMENTAR_OFERTA';
  }

  if (variacao <= LIMIAR_VARIACAO_BAIXA) {
    return 'OFERTAR_DESCONTO';
  }

  return 'CRIAR_PROMOCAO';
}

/** Soma `quantidade` por SKU em todas as vendas recebidas; os `max` maiores, em ordem decrescente e, no empate, pelo nome. */
export function produtosMaisComprados(
  vendas: Sale[],
  max: number,
): { sku: string; nome: string; quantidade: number }[] {
  const porSku = new Map<string, { sku: string; nome: string; quantidade: number }>();

  for (const venda of vendas) {
    for (const produto of venda.produtos) {
      const acumulado = porSku.get(produto.sku);

      if (acumulado) {
        acumulado.quantidade += produto.quantidade;
      } else {
        porSku.set(produto.sku, { sku: produto.sku, nome: produto.nome, quantidade: produto.quantidade });
      }
    }
  }

  return [...porSku.values()]
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, max);
}

function montarTitulo(nomeDoEvento: string, diasAteEvento: number): string {
  if (diasAteEvento === 0) {
    return `${nomeDoEvento} é hoje`;
  }

  if (diasAteEvento === 1) {
    return `${nomeDoEvento} é amanhã`;
  }

  return `${nomeDoEvento} em ${diasAteEvento} dias`;
}

/** "+5", "-12" ou "0" (sem sinal para zero); `-0` também vira "0". */
function percentualComSinal(variacaoPercentual: number): string {
  return `${variacaoPercentual > 0 ? '+' : ''}${variacaoPercentual}`;
}

/**
 * Título e texto da sugestão ao representante. O nome do evento vem de
 * `NOME_DO_EVENTO[chave]` (sem o ano) e `variacaoPercentual` é o percentual
 * já arredondado (85, -30). Com `produtos` vazio, o trecho " de {produtos}"
 * é omitido e a frase continua terminando em ponto.
 */
export function montarTextoDaSugestao(
  evento: EventoProximo,
  acao: AcaoSugerida,
  variacaoPercentual: number,
  produtos: { nome: string }[],
): { titulo: string; texto: string } {
  const titulo = montarTitulo(NOME_DO_EVENTO[evento.chave], evento.diasAteEvento);
  const listaDeProdutos = listarProdutos(produtos.map((produto) => produto.nome));
  const deProdutos = listaDeProdutos === '' ? '' : ` de ${listaDeProdutos}`;
  const percentual = Math.abs(variacaoPercentual);

  switch (acao) {
    case 'AUMENTAR_OFERTA':
      return {
        titulo,
        texto: `Comprou ${percentual}% a mais no mesmo período do ano passado. Aumentar a oferta${deProdutos}.`,
      };
    case 'CRIAR_PROMOCAO':
      return {
        titulo,
        texto: `As compras no mesmo período do ano passado ficaram na média (${percentualComSinal(variacaoPercentual)}%). Criar promoção sazonal para puxar o volume${deProdutos}.`,
      };
    case 'OFERTAR_DESCONTO':
      return {
        titulo,
        texto: `Comprou ${percentual}% a menos no mesmo período do ano passado. Ofertar desconto para recuperar o volume${deProdutos}.`,
      };
  }
}

/** Evento mais próximo primeiro -> mais clientes afetados -> nome do produto, para desempate estável. */
function compararAlerta(a: AlertaProducao, b: AlertaProducao): number {
  return (
    a.evento.diasAteEvento - b.evento.diasAteEvento ||
    b.clientes.length - a.clientes.length ||
    a.produto.nome.localeCompare(b.produto.nome, 'pt-BR')
  );
}

/**
 * Alertas de produção (UC15): cada item `BAIXO` cujo SKU está em
 * `SKUS_SUGERIDOS[evento.chave]` entra no alerta do par (evento, produto),
 * com os clientes em ordem crescente de quantidade (o mais crítico primeiro).
 * Itens de SKU fora do evento (ex.: `PAO-MEL` antes do Natal) e clientes sem
 * item baixo não geram alerta.
 */
export function cruzarEstoqueComEventos(clientes: ClienteComEstoque[], eventos: EventoProximo[]): AlertaProducao[] {
  const alertasPorEventoEProduto = new Map<string, AlertaProducao>();

  for (const evento of eventos) {
    const skusDoEvento = SKUS_SUGERIDOS[evento.chave];

    for (const cliente of clientes) {
      for (const item of cliente.itensBaixos) {
        if (!skusDoEvento.includes(item.sku)) {
          continue;
        }

        const chaveDoGrupo = `${evento.id}:${item.sku}`;
        let alerta = alertasPorEventoEProduto.get(chaveDoGrupo);

        if (!alerta) {
          alerta = {
            evento: {
              id: evento.id,
              nome: evento.nome,
              dataEvento: evento.dataEvento,
              diasAteEvento: evento.diasAteEvento,
            },
            produto: { sku: item.sku, nome: item.nome },
            clientes: [],
          };
          alertasPorEventoEProduto.set(chaveDoGrupo, alerta);
        }

        alerta.clientes.push({
          id: cliente.id,
          nomeFantasia: cliente.nomeFantasia,
          cidade: cliente.cidade,
          quantidade: item.quantidade,
          atualizadoEm: item.atualizadoEm.toISOString(),
        });
      }
    }
  }

  const alertas = [...alertasPorEventoEProduto.values()];

  for (const alerta of alertas) {
    alerta.clientes.sort(
      (a, b) => a.quantidade - b.quantidade || a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'),
    );
  }

  return alertas.sort(compararAlerta);
}
