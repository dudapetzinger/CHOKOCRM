import { env } from '../config/env';
import { erpProvider } from '../providers/erp';
import { chaveHibrida } from '../providers/erp/chave-hibrida';
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
import { dataCalendario, fimDoDia, inicioDoDia, somarDias } from './classificacao.service';
import { agora } from '../lib/relogio';

const DIAS_DE_VOLUME = 90;
/** Quantas vendas a ficha lista em `ultimasVendas` (só para clientes com fonte `notas`). */
const QUANTIDADE_DE_ULTIMAS_VENDAS = 5;

/**
 * Único módulo do sistema que fala com `erpProvider` e com o
 * catálogo do ERP: services e controllers de
 * cliente/agenda consomem `consultarUltimasVendas` daqui; o check-in e as
 * campanhas, `buscarProduto`. Nunca o provider diretamente. Única
 * exceção: o seed de demonstração (`seed/demonstracao.ts`) lê o catálogo
 * de demonstração (`CATALOGO`) direto, seja qual for o provedor, e o grava
 * em `ErpProduct` para o importado e o híbrido também o oferecerem. Três
 * provedores (`ERP_PROVIDER`): `mock`, que identifica o cliente pelo `erpId`
 * e tem o catálogo fixo de demonstração; `importado`, que
 * identifica o cliente pelo CNPJ, lê as notas fiscais importadas mais os
 * pedidos dos check-ins sem nota e o catálogo aprendido das notas
 * (`ErpProduct`), sem estoque; e `hibrido` (o padrão), com chave composta
 * `cnpj|erpId`: o cliente com nota do CNPJ usa as notas, o sem nota e com
 * `erpId` usa o simulado, e o catálogo é o `ErpProduct`. A fonte de cada
 * cliente (`notas`, `simulado` ou `nenhuma`) sai de `fonteDoCliente` e decide
 * a ficha (`obterDadosErp`) e os insights. Quem chama nunca escolhe a chave:
 * passa o cliente a `chaveDoCliente`.
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
      /** O cliente tem fonte `notas` (as notas não informam estoque): `estoque` é sempre `null`. */
      estoqueIndisponivel: boolean;
      /** As vendas mais recentes, `data` em 'AAAA-MM-DD'; só com fonte `notas` (`[]` no simulado). */
      ultimasVendas: VendaDTO[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'NAO_ENCONTRADO' }
  | { status: 'INDISPONIVEL' };

/**
 * Uma venda já serializável, com a data em 'AAAA-MM-DD'. No importado,
 * `origem` diz se é uma nota fiscal (`numero`) ou o pedido de um check-in
 * sem nota (`visitaId`); o mock não preenche.
 */
export type VendaDTO = Omit<Sale, 'data'> & { data: string };

/**
 * O que o ERP precisa do cliente para identificá-lo: `erpId` (mock), CNPJ
 * (importado) ou os dois (híbrido).
 */
export type ClienteDoErp = { erpId: string | null; cnpj: string };

/**
 * De onde vêm os dados de venda de um cliente: as notas importadas do CNPJ
 * (mais os pedidos dos check-ins sem nota), o ERP simulado pelo `erpId`, ou
 * nenhuma fonte (sem nota e sem `erpId`: `SEM_ERP_ID`).
 */
export type FonteDoCliente = 'notas' | 'simulado' | 'nenhuma';

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

/**
 * O catálogo de produtos e a situação das notas vêm do banco (`ErpProduct`,
 * `ErpSale`) no importado e no híbrido; só o mock usa o catálogo fixo.
 */
export function usaCatalogoDasNotas(): boolean {
  return env.ERP_PROVIDER !== 'mock';
}

function cnpjSoDigitos(cliente: ClienteDoErp): string {
  return cliente.cnpj.replace(/\D/g, '');
}

/**
 * Identificador do cliente no provedor em uso: o `erpId` no mock (`null`
 * sem ele: o cliente não está no ERP simulado), o CNPJ, só dígitos, no
 * importado (todo cliente tem) e, no híbrido, a chave composta
 * `cnpj|erpId` (`chaveHibrida`), com a qual o provedor decide a fonte a cada
 * consulta. Síncrona e uma string, para os lotes deduplicarem por
 * `Set`/`Map`. Todo chamador que consulta o ERP por cliente resolve a chave
 * aqui.
 */
export function chaveDoCliente(cliente: ClienteDoErp): string | null {
  switch (env.ERP_PROVIDER) {
    case 'importado':
      return cnpjSoDigitos(cliente);
    case 'hibrido':
      return chaveHibrida(cnpjSoDigitos(cliente), cliente.erpId || null);
    case 'mock':
      return cliente.erpId || null;
  }
}

/**
 * Fonte dos dados de venda do cliente (ver `FonteDoCliente`): no mock,
 * `simulado` com `erpId`; no importado, sempre `notas` (cliente sem nota é
 * `OK` sem venda); no híbrido, `notas` se há nota importada do CNPJ (uma
 * consulta de existência), senão `simulado` com `erpId`, senão `nenhuma`
 * (a mesma regra que `HibridoErpProvider` aplica a cada chamada).
 */
export async function fonteDoCliente(cliente: ClienteDoErp): Promise<FonteDoCliente> {
  switch (env.ERP_PROVIDER) {
    case 'mock':
      return cliente.erpId ? 'simulado' : 'nenhuma';
    case 'importado':
      return 'notas';
    case 'hibrido':
      if (await erpSaleRepository.existeNotaDoCnpj(cnpjSoDigitos(cliente))) {
        return 'notas';
      }
      return cliente.erpId ? 'simulado' : 'nenhuma';
  }
}

/** Indica se o ERP em uso é o simulado (mock de demonstração), para telas e insights sinalizarem isso. */
export function erpSimulado(): boolean {
  return erpProvider.simulado;
}

/**
 * Indica se o ERP em uso informa estoque (o mock e o híbrido sim; só as notas
 * importadas não). No híbrido o estoque é por cliente: o de fonte `notas`
 * não tem snapshots (`getStockHistory` vazio).
 */
export function estoqueDisponivel(): boolean {
  return erpProvider.estoqueDisponivel;
}

export type ProdutoDTO = { sku: string; nome: string; precoUnitario: number };

/**
 * Produtos que o check-in oferece no pedido, com o preço do dia:
 * no mock, o catálogo fixo de demonstração, na ordem dele; no importado e no
 * híbrido, o catálogo das notas (`ErpProduct`, que o seed também preenche),
 * por nome.
 */
export async function listarProdutos(): Promise<ProdutoDTO[]> {
  if (usaCatalogoDasNotas()) {
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
 * Um produto do catálogo pelo SKU (no importado e no híbrido, o código do
 * produto na nota), com o preço do dia; `null` se o SKU não existe. É por aqui que o
 * pedido do check-in e as campanhas validam os SKUs: nenhum outro módulo lê
 * o catálogo do ERP direto.
 */
export async function buscarProduto(sku: string): Promise<ProdutoDTO | null> {
  if (usaCatalogoDasNotas()) {
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
 * Se o ERP estiver indisponível, devolve `null` para o cliente afetado: quem
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
 * `null` quando o ERP está indisponível: o warn é registrado aqui e quem
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
 * (um único warn para o lote), para quem chama distinguir "sem venda" de
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
  return {
    data: dataCalendario(venda.data),
    valor: venda.valor,
    produtos: venda.produtos,
    ...(venda.origem ? { origem: venda.origem } : {}),
  };
}

/**
 * Dados de venda/estoque do cliente no ERP: busca o cliente, decide a
 * fonte (`fonteDoCliente`), resolve a chave (`chaveDoCliente`) e consulta o
 * provedor. Cliente de outra carteira responde ao representante como
 * inexistente (404). Qualquer `ErpIndisponivelError` vira
 * `{ status: 'INDISPONIVEL' }`; outros erros propagam para o errorHandler.
 * Por fonte: `nenhuma` → `SEM_ERP_ID`; `notas` (importado, ou híbrido com
 * nota do CNPJ) → nunca `NAO_ENCONTRADO` (cliente sem nota é `OK` sem última
 * venda), a ficha recebe as últimas vendas e o estoque é indisponível;
 * `simulado` → só a última venda, com estoque, e `NAO_ENCONTRADO` quando o
 * ERP simulado não conhece o `erpId`.
 */
export async function obterDadosErp(
  clientId: string,
  usuario: UsuarioAutenticado,
  hoje: Date = agora(),
): Promise<DadosErpDTO> {
  const cliente = exigirClienteVisivel(await clientRepository.findById(clientId), usuario);
  const fonte = await fonteDoCliente(cliente);
  const chave = chaveDoCliente(cliente);

  if (fonte === 'nenhuma' || !chave) {
    return { status: 'SEM_ERP_ID' };
  }

  const comNotas = fonte === 'notas';
  const hojeCal = dataCalendario(hoje);
  const periodo = {
    inicio: inicioDoDia(somarDias(hojeCal, -DIAS_DE_VOLUME)),
    fim: fimDoDia(hojeCal),
  };

  try {
    // Com notas, uma consulta só traz as últimas vendas, e a primeira é a
    // última venda; no simulado, só a última venda (a ficha não lista vendas).
    const [recentes, historicoDeEstoque, volume90Dias] = await Promise.all([
      comNotas
        ? erpProvider.getRecentSales(chave, QUANTIDADE_DE_ULTIMAS_VENDAS)
        : erpProvider.getLastSale(chave).then((venda) => (venda ? [venda] : [])),
      erpProvider.getStockHistory(chave),
      erpProvider.getPurchaseVolume(chave, periodo),
    ]);
    const ultimaVenda = recentes[0] ?? null;

    if (!comNotas && ultimaVenda === null && historicoDeEstoque.length === 0) {
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
      estoqueIndisponivel: comNotas,
      ultimasVendas: comNotas ? recentes.map(paraVendaDTO) : [],
    };
  } catch (err) {
    if (err instanceof ErpIndisponivelError) {
      logger.warn({ clientId, chave, err }, 'ERP indisponível ao consultar dados do cliente');
      return { status: 'INDISPONIVEL' };
    }

    throw err;
  }
}
