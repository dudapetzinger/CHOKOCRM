import { HORIZONTE_PADRAO_DIAS, LIMITE_ESTOQUE_BAIXO, SKUS_SUGERIDOS } from '../config/sazonalidade';
import * as clientRepository from '../repositories/client.repository';
import { dataCalendario, fimDoDia, inicioDoDia, type DataCalendario } from './classificacao.service';
import {
  chaveDoCliente,
  consultarEstoqueEmLote,
  consultarVendasEmLote,
  erpSimulado,
  estoqueDisponivel,
  listarProdutos,
  type ResumoEstoque,
} from './erp.service';
import { campanhasDaJanela, janelaDeVendas, janelaDoAnoAnterior, type CampanhaDaJanela, type Janela } from './insights.regras';
import { campanhasDoHorizonte, eventosDoHorizonte } from './insights.service';
import {
  clientesComEstoqueBaixo,
  estoqueBaixoPorProduto,
  janelaAtualAteHoje,
  periodoQueCobre,
  totalDaCarteira,
  type ClienteComEstoqueInformado,
  type EstoqueBaixoDoProduto,
} from './sazonalidade-painel.regras';
import { agora } from '../lib/relogio';

/**
 * Aba de datas comemorativas do Painel: para cada data do horizonte, as
 * vendas da carteira na janela da mesma data no ano anterior e na janela deste
 * ano até hoje, as campanhas que cobrem a janela e os clientes com estoque
 * baixo dos produtos indicados para a data. As vendas vêm da mesma fonte do
 * gráfico de vendas mensais (`consultarVendasEmLote`, cada cliente pela sua
 * fonte no híbrido): uma consulta por cliente, num período que cobre todas as
 * janelas, recortada depois em memória. O estoque é o informado pelo ERP
 * simulado (o do ponto de venda) e só existe para clientes sem nota
 * importada: uma consulta por cliente.
 */
export type DataComemorativaDTO = {
  id: string;
  nome: string;
  chave: string;
  /** Dia da data comemorativa, 'AAAA-MM-DD'. */
  data: DataCalendario;
  /** Dias de hoje até a data; 0 no próprio dia. */
  diasAte: number;
  /** Janela de vendas deste ano: 30 dias antes da data até o dia. */
  janela: Janela;
  /** A mesma janela no ano anterior, pela data real daquele ano. */
  janelaAnoAnterior: Janela;
  /** R$ vendidos pela carteira em `janelaAnoAnterior`. */
  vendasAnoAnterior: number;
  /** R$ vendidos pela carteira de `janela.inicio` até hoje; `null` enquanto a janela não começou. */
  vendasNaJanelaAtual: number | null;
  campanhas: CampanhaDaJanela[];
  /** Clientes baixos em ao menos um dos produtos da data, cada um contado uma vez. */
  clientesComEstoqueBaixo: number;
  estoqueBaixo: EstoqueBaixoDoProduto[];
};

export type SazonalidadeDoPainelDTO = {
  hoje: DataCalendario;
  horizonteDias: number;
  simulado: boolean;
  /** Abaixo desta quantidade (unidades) o item está em estoque baixo. */
  limiteEstoqueBaixo: number;
  /** Clientes ativos da carteira filtrada. */
  clientesDaCarteira: number;
  /** Dos ativos, os que têm chave no ERP (os consultados). */
  clientesConsultados: number;
  /** Dos consultados, os que informam estoque (snapshot no ERP). */
  clientesComEstoque: number;
  /** O ERP em uso não informa estoque de ninguém (importado). */
  estoqueIndisponivel: boolean;
  /** Clientes que o ERP não respondeu, por consulta; ficam fora das somas e do estoque. */
  clientesIndisponiveis: { vendas: number; estoque: number };
  /** Em ordem de proximidade. */
  datas: DataComemorativaDTO[];
};

type ClienteConsultado = clientRepository.ClienteParaAgenda & { chave: string };

/** Nome do catálogo por SKU, para o produto indicado que nenhum cliente tem baixo também ter nome. */
async function nomesDoCatalogo(): Promise<Map<string, string>> {
  const produtos = await listarProdutos();
  return new Map(produtos.map(({ sku, nome }) => [sku, nome]));
}

/**
 * Com `representanteId`, só a carteira daquele representante; sem ele, a
 * empresa toda. Sem data no horizonte, o ERP não é consultado.
 */
export async function obterSazonalidadeDoPainel(
  horizonteDias: number = HORIZONTE_PADRAO_DIAS,
  agoraDoSistema: Date = agora(),
  representanteId?: string,
): Promise<SazonalidadeDoPainelDTO> {
  const hoje = dataCalendario(agoraDoSistema);
  const ativos = await clientRepository.listAtivosParaAgenda(representanteId);
  const consultados = ativos.flatMap((cliente): ClienteConsultado[] => {
    const chave = chaveDoCliente(cliente);
    return chave ? [{ ...cliente, chave }] : [];
  });
  const eventos = await eventosDoHorizonte(hoje, horizonteDias);

  const base = {
    hoje,
    horizonteDias,
    simulado: erpSimulado(),
    limiteEstoqueBaixo: LIMITE_ESTOQUE_BAIXO,
    clientesDaCarteira: ativos.length,
    clientesConsultados: consultados.length,
    estoqueIndisponivel: !estoqueDisponivel(),
  };

  if (eventos.length === 0) {
    return { ...base, clientesComEstoque: 0, clientesIndisponiveis: { vendas: 0, estoque: 0 }, datas: [] };
  }

  const janelas = eventos.map((evento) => ({
    evento,
    janela: janelaDeVendas(evento),
    janelaAnoAnterior: janelaDoAnoAnterior(evento.chave, Number(evento.dataEvento.slice(0, 4))),
  }));
  const periodo = periodoQueCobre(janelas.map(({ janelaAnoAnterior }) => janelaAnoAnterior));
  const chaves = consultados.map(({ chave }) => chave);

  const [vendas, estoque, campanhasDoPeriodo, nomes] = await Promise.all([
    // As vendas só existem até hoje: o período vai da janela mais antiga ao fim de hoje.
    consultarVendasEmLote(chaves, { inicio: inicioDoDia(periodo.inicio), fim: fimDoDia(hoje) }),
    estoqueDisponivel()
      ? consultarEstoqueEmLote(chaves)
      : Promise.resolve({ resumoPorChave: new Map<string, ResumoEstoque | null>(), indisponiveis: [] as string[] }),
    campanhasDoHorizonte(eventos, hoje),
    nomesDoCatalogo(),
  ]);

  const vendasPorCliente = consultados.flatMap(({ chave }) => {
    const doCliente = vendas.vendasPorChave.get(chave);
    return doCliente ? [doCliente] : [];
  });
  const clientesComEstoque = consultados.flatMap((cliente): ClienteComEstoqueInformado[] => {
    const resumo = estoque.resumoPorChave.get(cliente.chave);
    return resumo
      ? [{ id: cliente.id, nomeFantasia: cliente.nomeFantasia, cidade: cliente.cidade, itensBaixos: resumo.itensBaixos }]
      : [];
  });
  const vendasIndisponiveis = new Set(vendas.indisponiveis);
  const estoqueIndisponiveis = new Set(estoque.indisponiveis);

  return {
    ...base,
    clientesComEstoque: clientesComEstoque.length,
    // Conta clientes, não chaves: dois clientes com a mesma chave sem resposta são dois.
    clientesIndisponiveis: {
      vendas: consultados.filter(({ chave }) => vendasIndisponiveis.has(chave)).length,
      estoque: consultados.filter(({ chave }) => estoqueIndisponiveis.has(chave)).length,
    },
    datas: janelas.map(({ evento, janela, janelaAnoAnterior }): DataComemorativaDTO => {
      const estoqueBaixo = estoqueBaixoPorProduto(SKUS_SUGERIDOS[evento.chave], nomes, clientesComEstoque);

      return {
        id: evento.id,
        nome: evento.nome,
        chave: evento.chave,
        data: evento.dataEvento,
        diasAte: evento.diasAteEvento,
        janela,
        janelaAnoAnterior,
        vendasAnoAnterior: totalDaCarteira(vendasPorCliente, janelaAnoAnterior) ?? 0,
        vendasNaJanelaAtual: totalDaCarteira(vendasPorCliente, janelaAtualAteHoje(janela, hoje)),
        campanhas: campanhasDaJanela(campanhasDoPeriodo, janela, hoje),
        clientesComEstoqueBaixo: clientesComEstoqueBaixo(estoqueBaixo),
        estoqueBaixo,
      };
    }),
  };
}
