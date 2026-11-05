import { env, type Env } from '../config/env';
import { erpProvider } from '../providers/erp';
import {
  ErpIndisponivelError,
  type NivelEstoque,
  type Period,
  type Sale,
  type StockSnapshot,
  type Volume,
} from '../providers/erp/ErpProvider';
import { CATALOGO } from '../providers/erp/mock/catalogo';
import * as clientRepository from '../repositories/client.repository';
import * as erpSaleRepository from '../repositories/erp-sale.repository';
import { logger } from '../lib/logger';
// De `carteira`, não de `client.service`: este depende daqui (`consultarUltimasVendas`).
import { exigirClienteVisivel, type UsuarioAutenticado } from './carteira';
import { dataCalendario, dataDaColunaDate, fimDoDia, inicioDoDia, somarDias } from './classificacao.service';

const DIAS_DE_VOLUME = 90;
/** Quantas vendas a ficha lista em `ultimasVendas` (só no provedor importado). */
const QUANTIDADE_DE_ULTIMAS_VENDAS = 5;

/**
 * Único módulo do sistema que fala com `erpProvider` (Task 4 do plano de
 * design da Etapa 5) e com o catálogo do ERP: services e controllers de
 * cliente/agenda consomem `consultarUltimasVendas` daqui; o check-in e as
 * campanhas, `buscarProduto`. Nunca o provider diretamente. Exceção
 * autorizada: o seed de demonstração (`seed/demonstracao.ts`) lê o catálogo
 * de demonstração (`CATALOGO`) direto, seja qual for o provedor, e o grava
 * em `ErpProduct` para o importado também o oferecer. Dois provedores
 * (`ERP_PROVIDER`): `mock`, que identifica o cliente pelo `erpId` e tem o
 * catálogo fixo de demonstração, e `importado` (Etapa 12b), que identifica o
 * cliente pelo CNPJ, lê as notas fiscais importadas e o catálogo aprendido
 * delas (`ErpProduct`), sem estoque. Quem chama nunca escolhe a chave: passa
 * o cliente a `chaveDoCliente`.
 */
export type DadosErpDTO =
  | {
      status: 'OK';
      simulado: boolean;
      ultimaVenda: { data: string; valor: number } | null;
      volume90Dias: Volume;
      estoque: {
        nivel: NivelEstoque;
        atualizadoEm: string;
        itensBaixos: { sku: string; nome: string; quantidade: number }[];
      } | null;
      /** O provedor não informa estoque (importado): `estoque` é sempre `null`. */
      estoqueIndisponivel: boolean;
      /** As vendas mais recentes, `data` em 'AAAA-MM-DD'; só no importado (`[]` no mock). */
      ultimasVendas: VendaDTO[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'NAO_ENCONTRADO' }
  | { status: 'INDISPONIVEL' };

/** Uma venda (nota) já serializável, com a data em 'AAAA-MM-DD'. */
export type VendaDTO = Omit<Sale, 'data'> & { data: string };

/** Situação da fonte de vendas (`GET /erp/situacao`). */
export type SituacaoErpDTO = {
  provedor: Env['ERP_PROVIDER'];
  simulado: boolean;
  estoqueDisponivel: boolean;
  /** Emissão da nota mais recente, 'AAAA-MM-DD'; `null` sem notas ou no mock. */
  ultimaVendaEm: string | null;
  /** Instante (ISO) da importação mais recente; `null` se nunca houve. */
  ultimaImportacaoEm: string | null;
};

/** O que o ERP precisa do cliente para identificá-lo: `erpId` (mock) ou CNPJ (importado). */
export type ClienteDoErp = { erpId: string | null; cnpj: string };

/** Item de estoque em nível BAIXO; `atualizadoEm` é a data do snapshot de onde veio. */
export type ItemBaixo = { sku: string; nome: string; quantidade: number; atualizadoEm: Date };

/** Snapshot mais recente do estoque: pior nível da data e os itens em nível BAIXO. */
export type ResumoEstoque = { nivel: NivelEstoque; atualizadoEm: string; itensBaixos: ItemBaixo[] };

/** Ordem de "pior" nível de estoque: BAIXO é o pior, ALTO o melhor. */
const ORDEM_DE_GRAVIDADE: Record<NivelEstoque, number> = {
  BAIXO: 0,
  NORMAL: 1,
  ALTO: 2,
};

type RespostaDoLote<T> = { chave: string; disponivel: true; resultado: T } | { chave: string; disponivel: false };

/**
 * Consulta o ERP uma vez por chave distinta (ignora `null`/vazia e
 * repetidas), em paralelo. Se o ERP estiver indisponível para alguma chave,
 * registra um único warn para o lote inteiro (não um por cliente) e a devolve
 * em `indisponiveis`, na ordem de `chaves`; as demais seguem. Outros erros
 * propagam.
 */
async function consultarEmLote<T>(
  chaves: (string | null)[],
  consultar: (chave: string) => Promise<T>,
  mensagemDeIndisponibilidade: string,
): Promise<{ resultados: Map<string, T>; indisponiveis: string[] }> {
  const chavesUnicas = [...new Set(chaves.filter((chave): chave is string => Boolean(chave)))];
  let indisponivelJaLogado = false;

  const respostas = await Promise.all(
    chavesUnicas.map(async (chave): Promise<RespostaDoLote<T>> => {
      try {
        return { chave, disponivel: true, resultado: await consultar(chave) };
      } catch (err) {
        if (err instanceof ErpIndisponivelError) {
          if (!indisponivelJaLogado) {
            indisponivelJaLogado = true;
            logger.warn({ err }, mensagemDeIndisponibilidade);
          }

          return { chave, disponivel: false };
        }

        throw err;
      }
    }),
  );

  const resultados = new Map<string, T>();
  const indisponiveis: string[] = [];

  for (const resposta of respostas) {
    if (resposta.disponivel) {
      resultados.set(resposta.chave, resposta.resultado);
    } else {
      indisponiveis.push(resposta.chave);
    }
  }

  return { resultados, indisponiveis };
}

/** O provedor em uso é o das notas fiscais importadas (Etapa 12b)? */
function provedorImportado(): boolean {
  return env.ERP_PROVIDER === 'importado';
}

/**
 * Identificador do cliente no provedor em uso: o `erpId` no mock (`null`
 * sem ele: o cliente não está no ERP simulado) e o CNPJ, só dígitos, no
 * importado (todo cliente tem). Todo chamador que consulta o ERP por cliente
 * resolve a chave aqui.
 */
export function chaveDoCliente(cliente: ClienteDoErp): string | null {
  if (provedorImportado()) {
    return cliente.cnpj.replace(/\D/g, '');
  }

  return cliente.erpId || null;
}

/** Indica se o ERP em uso é o simulado (mock de demonstração), para telas e insights sinalizarem isso. */
export function erpSimulado(): boolean {
  return erpProvider.simulado;
}

/** Indica se o ERP em uso informa estoque (o mock sim; as notas importadas não). */
export function estoqueDisponivel(): boolean {
  return erpProvider.estoqueDisponivel;
}

/**
 * Situação da fonte de vendas para os avisos das telas (`GET /erp/situacao`):
 * o provedor e, no importado, até que dia há notas. A última importação vem
 * do banco em qualquer provedor.
 */
export async function obterSituacao(): Promise<SituacaoErpDTO> {
  const [ultimaEmissao, ultimaImportacao] = await Promise.all([
    provedorImportado() ? erpSaleRepository.ultimaDataDeEmissao() : Promise.resolve(null),
    erpSaleRepository.ultimaImportacaoEm(),
  ]);

  return {
    provedor: env.ERP_PROVIDER,
    simulado: erpProvider.simulado,
    estoqueDisponivel: erpProvider.estoqueDisponivel,
    ultimaVendaEm: ultimaEmissao ? dataDaColunaDate(ultimaEmissao) : null,
    ultimaImportacaoEm: ultimaImportacao ? ultimaImportacao.toISOString() : null,
  };
}

export type ProdutoDTO = { sku: string; nome: string; precoUnitario: number };

/**
 * Produtos que o check-in oferece no pedido (spec 7.5), com o preço do dia:
 * no mock, o catálogo fixo de demonstração, na ordem dele; no importado, o
 * catálogo aprendido das notas (`ErpProduct`), por nome.
 */
export async function listarProdutos(): Promise<ProdutoDTO[]> {
  if (provedorImportado()) {
    const produtos = await erpSaleRepository.listarProdutos();
    return produtos.map(({ codigo, nome, precoUnitario }) => ({
      sku: codigo,
      nome,
      precoUnitario: precoUnitario.toNumber(),
    }));
  }

  return CATALOGO.map(({ sku, nome, precoUnitario }) => ({ sku, nome, precoUnitario }));
}

/**
 * Um produto do catálogo pelo SKU (no importado, o código do produto na
 * nota), com o preço do dia; `null` se o SKU não existe. É por aqui que o
 * pedido do check-in e as campanhas validam os SKUs: nenhum outro módulo lê
 * o catálogo do ERP direto.
 */
export async function buscarProduto(sku: string): Promise<ProdutoDTO | null> {
  if (provedorImportado()) {
    const produto = await erpSaleRepository.findProdutoPorCodigo(sku);
    return produto
      ? { sku: produto.codigo, nome: produto.nome, precoUnitario: produto.precoUnitario.toNumber() }
      : null;
  }

  const produto = CATALOGO.find((candidato) => candidato.sku === sku);
  return produto ? { sku: produto.sku, nome: produto.nome, precoUnitario: produto.precoUnitario } : null;
}

/**
 * Última venda de cada chave (de `chaveDoCliente`), para telas que listam
 * vários clientes de uma vez (lista de clientes, ficha do cliente, agenda).
 * Se o ERP estiver indisponível, devolve `null` para o cliente afetado — quem
 * chama não precisa saber que o ERP está fora do ar.
 */
export async function consultarUltimasVendas(chaves: (string | null)[]): Promise<Map<string, Date | null>> {
  const { resultados, indisponiveis } = await consultarEmLote(
    chaves,
    async (chave) => (await erpProvider.getLastSale(chave))?.data ?? null,
    'ERP indisponível ao consultar últimas vendas em lote',
  );

  for (const chave of indisponiveis) {
    resultados.set(chave, null);
  }

  return resultados;
}

/**
 * Última venda de cada cliente indexada pelo `id` do cliente (e não pela
 * chave do ERP), para as montagens puras da agenda, que não conhecem o
 * provedor. Mesma degradação de `consultarUltimasVendas`.
 */
export async function consultarUltimasVendasPorCliente(
  clientes: (ClienteDoErp & { id: string })[],
): Promise<Map<string, Date | null>> {
  const porChave = await consultarUltimasVendas(clientes.map(chaveDoCliente));
  return new Map(clientes.map((cliente) => [cliente.id, porChave.get(chaveDoCliente(cliente) ?? '') ?? null]));
}

/**
 * Vendas de um cliente (pela chave) no período (para os insights sazonais).
 * `null` quando o ERP está indisponível — o warn é registrado aqui e quem
 * chama decide como degradar; qualquer outro erro propaga.
 */
export async function consultarVendas(chave: string, periodo: Period): Promise<Sale[] | null> {
  try {
    return await erpProvider.getSales(chave, periodo);
  } catch (err) {
    if (err instanceof ErpIndisponivelError) {
      logger.warn({ chave, err }, 'ERP indisponível ao consultar vendas do período');
      return null;
    }

    throw err;
  }
}

/**
 * Vendas de cada chave no período (para o gráfico de vendas mensais). O que
 * o ERP não conseguiu responder vai para `indisponiveis` e fica fora do mapa
 * — um único warn para o lote —, para quem chama distinguir "sem venda" de
 * "não sei".
 */
export async function consultarVendasEmLote(
  chaves: (string | null)[],
  periodo: Period,
): Promise<{ vendasPorChave: Map<string, Sale[]>; indisponiveis: string[] }> {
  const { resultados, indisponiveis } = await consultarEmLote(
    chaves,
    (chave) => erpProvider.getSales(chave, periodo),
    'ERP indisponível ao consultar vendas em lote',
  );

  return { vendasPorChave: resultados, indisponiveis };
}

/**
 * Itens em nível BAIXO no snapshot de estoque mais recente de cada chave
 * (para os alertas de produção). Chave sem histórico (desconhecida no ERP)
 * fica com lista vazia; o que o ERP não conseguiu responder vai para
 * `indisponiveis` e fica fora do mapa, para quem chama distinguir "sem item
 * baixo" de "não sei".
 */
export async function consultarItensBaixosEmLote(
  chaves: (string | null)[],
): Promise<{ itensPorChave: Map<string, ItemBaixo[]>; indisponiveis: string[] }> {
  const { resultados, indisponiveis } = await consultarEmLote(
    chaves,
    async (chave) => resumirEstoque(await erpProvider.getStockHistory(chave))?.itensBaixos ?? [],
    'ERP indisponível ao consultar estoque em lote',
  );

  return { itensPorChave: resultados, indisponiveis };
}

/** Snapshot de estoque mais recente (por `data`), com o pior nível entre os itens dessa data. */
export function resumirEstoque(historico: StockSnapshot[]): ResumoEstoque | null {
  if (historico.length === 0) {
    return null;
  }

  const dataMaisRecente = historico.reduce(
    (maisRecente, item) => (item.data > maisRecente ? item.data : maisRecente),
    historico[0]!.data,
  );

  const itensDaData = historico.filter((item) => item.data.getTime() === dataMaisRecente.getTime());

  const nivel = itensDaData.reduce<NivelEstoque>(
    (pior, item) => (ORDEM_DE_GRAVIDADE[item.nivel] < ORDEM_DE_GRAVIDADE[pior] ? item.nivel : pior),
    itensDaData[0]!.nivel,
  );

  const itensBaixos = itensDaData
    .filter((item) => item.nivel === 'BAIXO')
    .map((item) => ({ sku: item.sku, nome: item.nome, quantidade: item.quantidade, atualizadoEm: item.data }));

  return { nivel, atualizadoEm: dataMaisRecente.toISOString(), itensBaixos };
}

/** Venda serializável: a data como o dia de calendário da venda. */
function paraVendaDTO(venda: Sale): VendaDTO {
  return { data: dataCalendario(venda.data), valor: venda.valor, produtos: venda.produtos };
}

/**
 * Dados de venda/estoque do cliente no ERP (UC11): busca o cliente, resolve
 * a chave (`chaveDoCliente`) e consulta o provedor. Cliente de outra
 * carteira responde ao representante como inexistente (404). Qualquer
 * `ErpIndisponivelError` vira `{ status: 'INDISPONIVEL' }` — outros erros
 * propagam para o errorHandler. No importado a chave é o CNPJ, que todo
 * cliente tem: nunca há `SEM_ERP_ID` nem `NAO_ENCONTRADO` (cliente sem nota
 * é `OK` sem última venda), e a ficha recebe as últimas vendas.
 */
export async function obterDadosErp(
  clientId: string,
  usuario: UsuarioAutenticado,
  hoje: Date = new Date(),
): Promise<DadosErpDTO> {
  const cliente = exigirClienteVisivel(await clientRepository.findById(clientId), usuario);
  const chave = chaveDoCliente(cliente);

  if (!chave) {
    return { status: 'SEM_ERP_ID' };
  }

  const importado = provedorImportado();
  const hojeCal = dataCalendario(hoje);
  const periodo = {
    inicio: inicioDoDia(somarDias(hojeCal, -DIAS_DE_VOLUME)),
    fim: fimDoDia(hojeCal),
  };

  try {
    // No importado, uma consulta só traz as últimas vendas, e a primeira é a
    // última venda; no mock, só a última venda (a ficha não lista vendas).
    const [recentes, historicoDeEstoque, volume90Dias] = await Promise.all([
      importado
        ? erpProvider.getRecentSales(chave, QUANTIDADE_DE_ULTIMAS_VENDAS)
        : erpProvider.getLastSale(chave).then((venda) => (venda ? [venda] : [])),
      erpProvider.getStockHistory(chave),
      erpProvider.getPurchaseVolume(chave, periodo),
    ]);
    const ultimaVenda = recentes[0] ?? null;

    if (!importado && ultimaVenda === null && historicoDeEstoque.length === 0) {
      return { status: 'NAO_ENCONTRADO' };
    }

    const resumoDeEstoque = resumirEstoque(historicoDeEstoque);

    return {
      status: 'OK',
      simulado: erpProvider.simulado,
      ultimaVenda: ultimaVenda ? { data: ultimaVenda.data.toISOString(), valor: ultimaVenda.valor } : null,
      volume90Dias,
      // O DTO não expõe `atualizadoEm` por item (já vai uma vez no resumo).
      estoque: resumoDeEstoque && {
        ...resumoDeEstoque,
        itensBaixos: resumoDeEstoque.itensBaixos.map(({ sku, nome, quantidade }) => ({ sku, nome, quantidade })),
      },
      estoqueIndisponivel: !erpProvider.estoqueDisponivel,
      ultimasVendas: importado ? recentes.map(paraVendaDTO) : [],
    };
  } catch (err) {
    if (err instanceof ErpIndisponivelError) {
      logger.warn({ clientId, chave, err }, 'ERP indisponível ao consultar dados do cliente');
      return { status: 'INDISPONIVEL' };
    }

    throw err;
  }
}
