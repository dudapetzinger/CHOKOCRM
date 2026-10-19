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
import { logger } from '../lib/logger';
// De `carteira`, não de `client.service`: este depende daqui (`consultarUltimasVendas`).
import { exigirClienteVisivel, type UsuarioAutenticado } from './carteira';
import { dataCalendario, fimDoDia, inicioDoDia, somarDias } from './classificacao.service';

const DIAS_DE_VOLUME = 90;

/**
 * Único módulo do sistema que fala com `erpProvider` (Task 4 do plano de
 * design da Etapa 5) e com o catálogo do ERP: services e controllers de
 * cliente/agenda consomem `consultarUltimasVendas` daqui; o check-in e as
 * campanhas, `buscarProduto`. Nunca o provider diretamente.
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
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'NAO_ENCONTRADO' }
  | { status: 'INDISPONIVEL' };

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

type RespostaDoLote<T> = { erpId: string; disponivel: true; resultado: T } | { erpId: string; disponivel: false };

/**
 * Consulta o ERP uma vez por `erpId` distinto (ignora `null`/vazio e
 * repetidos), em paralelo. Se o ERP estiver indisponível para algum id,
 * registra um único warn para o lote inteiro (não um por cliente) e o devolve
 * em `indisponiveis`, na ordem de `erpIds`; os demais seguem. Outros erros
 * propagam.
 */
async function consultarEmLote<T>(
  erpIds: (string | null)[],
  consultar: (erpId: string) => Promise<T>,
  mensagemDeIndisponibilidade: string,
): Promise<{ resultados: Map<string, T>; indisponiveis: string[] }> {
  const idsUnicos = [...new Set(erpIds.filter((erpId): erpId is string => Boolean(erpId)))];
  let indisponivelJaLogado = false;

  const respostas = await Promise.all(
    idsUnicos.map(async (erpId): Promise<RespostaDoLote<T>> => {
      try {
        return { erpId, disponivel: true, resultado: await consultar(erpId) };
      } catch (err) {
        if (err instanceof ErpIndisponivelError) {
          if (!indisponivelJaLogado) {
            indisponivelJaLogado = true;
            logger.warn({ err }, mensagemDeIndisponibilidade);
          }

          return { erpId, disponivel: false };
        }

        throw err;
      }
    }),
  );

  const resultados = new Map<string, T>();
  const indisponiveis: string[] = [];

  for (const resposta of respostas) {
    if (resposta.disponivel) {
      resultados.set(resposta.erpId, resposta.resultado);
    } else {
      indisponiveis.push(resposta.erpId);
    }
  }

  return { resultados, indisponiveis };
}

/** Indica se o ERP em uso é o simulado (mock de demonstração), para telas e insights sinalizarem isso. */
export function erpSimulado(): boolean {
  return erpProvider.simulado;
}

export type ProdutoDTO = { sku: string; nome: string; precoUnitario: number };

/**
 * Produtos que o check-in oferece no pedido (spec 7.5), na ordem do
 * catálogo: os mesmos do histórico do ERP simulado, com o preço do dia.
 */
export function listarProdutos(): ProdutoDTO[] {
  return CATALOGO.map(({ sku, nome, precoUnitario }) => ({ sku, nome, precoUnitario }));
}

/**
 * Um produto do catálogo pelo SKU, com o preço do dia; `null` se o SKU não
 * existe. É por aqui que o pedido do check-in e as campanhas validam os
 * SKUs: nenhum outro módulo lê o catálogo do ERP direto.
 */
export function buscarProduto(sku: string): ProdutoDTO | null {
  const produto = CATALOGO.find((candidato) => candidato.sku === sku);
  return produto ? { sku: produto.sku, nome: produto.nome, precoUnitario: produto.precoUnitario } : null;
}

/**
 * Última venda de cada `erpId`, para telas que listam vários clientes de
 * uma vez (lista de clientes, ficha do cliente, agenda). Se o ERP estiver
 * indisponível, devolve `null` para o cliente afetado — quem chama não
 * precisa saber que o ERP está fora do ar.
 */
export async function consultarUltimasVendas(erpIds: (string | null)[]): Promise<Map<string, Date | null>> {
  const { resultados, indisponiveis } = await consultarEmLote(
    erpIds,
    async (erpId) => (await erpProvider.getLastSale(erpId))?.data ?? null,
    'ERP indisponível ao consultar últimas vendas em lote',
  );

  for (const erpId of indisponiveis) {
    resultados.set(erpId, null);
  }

  return resultados;
}

/**
 * Vendas de um cliente no período (para os insights sazonais). `null` quando
 * o ERP está indisponível — o warn é registrado aqui e quem chama decide como
 * degradar; qualquer outro erro propaga.
 */
export async function consultarVendas(erpId: string, periodo: Period): Promise<Sale[] | null> {
  try {
    return await erpProvider.getSales(erpId, periodo);
  } catch (err) {
    if (err instanceof ErpIndisponivelError) {
      logger.warn({ erpId, err }, 'ERP indisponível ao consultar vendas do período');
      return null;
    }

    throw err;
  }
}

/**
 * Vendas de cada `erpId` no período (para o gráfico de vendas mensais). O que
 * o ERP não conseguiu responder vai para `indisponiveis` e fica fora do mapa
 * — um único warn para o lote —, para quem chama distinguir "sem venda" de
 * "não sei".
 */
export async function consultarVendasEmLote(
  erpIds: (string | null)[],
  periodo: Period,
): Promise<{ vendasPorErpId: Map<string, Sale[]>; indisponiveis: string[] }> {
  const { resultados, indisponiveis } = await consultarEmLote(
    erpIds,
    (erpId) => erpProvider.getSales(erpId, periodo),
    'ERP indisponível ao consultar vendas em lote',
  );

  return { vendasPorErpId: resultados, indisponiveis };
}

/**
 * Itens em nível BAIXO no snapshot de estoque mais recente de cada `erpId`
 * (para os alertas de produção). `erpId` sem histórico (desconhecido no ERP)
 * fica com lista vazia; o que o ERP não conseguiu responder vai para
 * `indisponiveis` e fica fora do mapa, para quem chama distinguir "sem item
 * baixo" de "não sei".
 */
export async function consultarItensBaixosEmLote(
  erpIds: (string | null)[],
): Promise<{ itensPorErpId: Map<string, ItemBaixo[]>; indisponiveis: string[] }> {
  const { resultados, indisponiveis } = await consultarEmLote(
    erpIds,
    async (erpId) => resumirEstoque(await erpProvider.getStockHistory(erpId))?.itensBaixos ?? [],
    'ERP indisponível ao consultar estoque em lote',
  );

  return { itensPorErpId: resultados, indisponiveis };
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

/**
 * Dados de venda/estoque do cliente no ERP (UC11): busca o cliente, resolve
 * o `erpId` e consulta o provedor. Cliente de outra carteira responde ao
 * representante como inexistente (404). Qualquer `ErpIndisponivelError` vira
 * `{ status: 'INDISPONIVEL' }` — outros erros propagam para o errorHandler.
 */
export async function obterDadosErp(
  clientId: string,
  usuario: UsuarioAutenticado,
  hoje: Date = new Date(),
): Promise<DadosErpDTO> {
  const cliente = exigirClienteVisivel(await clientRepository.findById(clientId), usuario);

  if (!cliente.erpId) {
    return { status: 'SEM_ERP_ID' };
  }

  const { erpId } = cliente;
  const hojeCal = dataCalendario(hoje);
  const periodo = {
    inicio: inicioDoDia(somarDias(hojeCal, -DIAS_DE_VOLUME)),
    fim: fimDoDia(hojeCal),
  };

  try {
    const [ultimaVenda, historicoDeEstoque, volume90Dias] = await Promise.all([
      erpProvider.getLastSale(erpId),
      erpProvider.getStockHistory(erpId),
      erpProvider.getPurchaseVolume(erpId, periodo),
    ]);

    if (ultimaVenda === null && historicoDeEstoque.length === 0) {
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
    };
  } catch (err) {
    if (err instanceof ErpIndisponivelError) {
      logger.warn({ clientId, erpId, err }, 'ERP indisponível ao consultar dados do cliente');
      return { status: 'INDISPONIVEL' };
    }

    throw err;
  }
}
