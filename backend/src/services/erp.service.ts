import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { erpProvider } from '../providers/erp';
import { ErpIndisponivelError, type NivelEstoque, type StockSnapshot, type Volume } from '../providers/erp/ErpProvider';
import * as clientRepository from '../repositories/client.repository';
import { logger } from '../lib/logger';
import { dataCalendario, fimDoDia, inicioDoDia, somarDias } from './classificacao.service';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const DIAS_DE_VOLUME = 90;

/**
 * Único módulo do sistema que fala com `erpProvider` (Task 4 do plano de
 * design da Etapa 5): services e controllers de cliente/agenda consomem
 * `consultarUltimasVendas` daqui, nunca o provider diretamente.
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

type EstoqueResumo = Extract<DadosErpDTO, { status: 'OK' }>['estoque'];

/** Ordem de "pior" nível de estoque: BAIXO é o pior, ALTO o melhor. */
const ORDEM_DE_GRAVIDADE: Record<NivelEstoque, number> = {
  BAIXO: 0,
  NORMAL: 1,
  ALTO: 2,
};

/**
 * Última venda de cada `erpId`, para telas que listam vários clientes de
 * uma vez (lista de clientes, ficha do cliente, agenda). Deduplica os
 * `erpId`s e consulta o provedor em paralelo; se o ERP estiver
 * indisponível, registra um único warn para o lote inteiro (não um por
 * cliente) e devolve `null` para cada um — quem chama não precisa saber
 * que o ERP está fora do ar.
 */
export async function consultarUltimasVendas(erpIds: (string | null)[]): Promise<Map<string, Date | null>> {
  const idsUnicos = [...new Set(erpIds.filter((erpId): erpId is string => Boolean(erpId)))];
  let indisponivelJaLogado = false;

  const resultados = await Promise.all(
    idsUnicos.map(async (erpId): Promise<[string, Date | null]> => {
      try {
        const venda = await erpProvider.getLastSale(erpId);
        return [erpId, venda?.data ?? null];
      } catch (err) {
        if (err instanceof ErpIndisponivelError) {
          if (!indisponivelJaLogado) {
            indisponivelJaLogado = true;
            logger.warn({ err }, 'ERP indisponível ao consultar últimas vendas em lote');
          }

          return [erpId, null];
        }

        throw err;
      }
    }),
  );

  return new Map(resultados);
}

/** Snapshot de estoque mais recente (por `data`), com o pior nível entre os itens dessa data. */
function resumirEstoque(historico: StockSnapshot[]): EstoqueResumo {
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
    .map((item) => ({ sku: item.sku, nome: item.nome, quantidade: item.quantidade }));

  return { nivel, atualizadoEm: dataMaisRecente.toISOString(), itensBaixos };
}

/**
 * Dados de venda/estoque do cliente no ERP (UC11): busca o cliente, resolve
 * o `erpId` e consulta o provedor. Qualquer `ErpIndisponivelError` vira
 * `{ status: 'INDISPONIVEL' }` — outros erros propagam para o errorHandler.
 */
export async function obterDadosErp(clientId: string, hoje: Date = new Date()): Promise<DadosErpDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

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

    return {
      status: 'OK',
      simulado: erpProvider.simulado,
      ultimaVenda: ultimaVenda ? { data: ultimaVenda.data.toISOString(), valor: ultimaVenda.valor } : null,
      volume90Dias,
      estoque: resumirEstoque(historicoDeEstoque),
    };
  } catch (err) {
    if (err instanceof ErpIndisponivelError) {
      logger.warn({ clientId, erpId, err }, 'ERP indisponível ao consultar dados do cliente');
      return { status: 'INDISPONIVEL' };
    }

    throw err;
  }
}
