import type { Goal, PeriodoMeta } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as campaignRepository from '../repositories/campaign.repository';
import * as goalRepository from '../repositories/goal.repository';
import type { MetaComRepresentante, MetaData } from '../repositories/goal.repository';
import * as userRepository from '../repositories/user.repository';
import type { ListarMetasQuery, MetaInput } from '../schemas/goal.schema';
import { representanteEfetivo, type UsuarioAutenticado } from './carteira';
import { colunaDateDaData, dataDaColunaDate, fimDoDia, inicioDoDia } from './classificacao.service';
import { metaDentroDaCampanha, periodoDaMeta, realizadoDaMeta, type Realizado } from './goal.regras';
import { resolverPeriodo } from './periodo';

/**
 * Metas de visitas e vendas (spec 7.8). O gestor cria, altera e exclui
 * (barrado nas rotas); o representante lê só as próprias. O realizado é
 * calculado a cada leitura, das visitas do representante no período.
 */

const MENSAGEM_META_NAO_ENCONTRADA = 'Meta não encontrada.';
const MENSAGEM_REPRESENTANTE = 'Escolha um representante.';
const MENSAGEM_REPRESENTANTE_INATIVO = 'Representante inativo.';
const MENSAGEM_CAMPANHA_NAO_ENCONTRADA = 'Campanha não encontrada.';
const MENSAGEM_FORA_DA_CAMPANHA = 'A meta deve ficar dentro do período da campanha.';

export type MetaDTO = {
  id: string;
  representante: { id: string; nome: string };
  periodo: PeriodoMeta;
  /** `AAAA-MM-DD`, inclusivo. */
  inicio: string;
  /** `AAAA-MM-DD`, inclusivo. */
  fim: string;
  metaVisitas: number;
  /** Em reais, com 2 casas. */
  metaVendas: number;
  campanhaId: string | null;
  realizado: Realizado;
};

/** As metas com o realizado de cada uma, numa leitura só das visitas dos representantes delas. */
async function montarDTOs(metas: MetaComRepresentante[]): Promise<MetaDTO[]> {
  if (metas.length === 0) return [];

  const periodos = metas.map((meta) => ({
    inicio: dataDaColunaDate(meta.inicio),
    fim: dataDaColunaDate(meta.fim),
  }));
  const primeiroDia = periodos.reduce((menor, { inicio }) => (inicio < menor ? inicio : menor), periodos[0]!.inicio);
  const ultimoDia = periodos.reduce((maior, { fim }) => (fim > maior ? fim : maior), periodos[0]!.fim);
  // A janela da busca vai das 00:00 do primeiro dia às 23:59 do último em
  // São Paulo; a regra pura confere o dia de cada visita em cada meta.
  const visitas = await goalRepository.listarVisitasParaMetas({
    autores: [...new Set(metas.map((meta) => meta.representanteId))],
    de: inicioDoDia(primeiroDia),
    ate: fimDoDia(ultimoDia),
  });

  return metas.map((meta, indice) => {
    const { inicio, fim } = periodos[indice]!;
    return {
      id: meta.id,
      representante: meta.representante,
      periodo: meta.periodo,
      inicio,
      fim,
      metaVisitas: meta.metaVisitas,
      metaVendas: meta.metaVendas.toDecimalPlaces(2).toNumber(),
      campanhaId: meta.campanhaId,
      realizado: realizadoDaMeta(visitas, {
        representanteId: meta.representanteId,
        inicio,
        fim,
        campanhaId: meta.campanhaId,
      }),
    };
  });
}

async function montarDTO(meta: MetaComRepresentante): Promise<MetaDTO> {
  const [dto] = await montarDTOs([meta]);
  return dto!;
}

/**
 * Confere o que depende do banco e devolve a meta como colunas. O
 * representante existe, é REPRESENTANTE e está ativo — manter o
 * representante de uma meta existente que foi inativado não é trocar para
 * um inativo, e passa. Semanal e mensal: o período sai da data de início.
 * Por campanha: a campanha existe e a meta cabe no período dela.
 */
async function dadosDaMeta(input: MetaInput, existente?: Goal): Promise<MetaData> {
  const representante = await userRepository.findById(input.representanteId);
  if (!representante || representante.role !== 'REPRESENTANTE') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_REPRESENTANTE, 400);
  }
  if (!representante.ativo && representante.id !== existente?.representanteId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_REPRESENTANTE_INATIVO, 400);
  }

  const { inicio, fim } =
    input.periodo === 'SEMANAL' || input.periodo === 'MENSAL'
      ? periodoDaMeta(input.periodo, input.inicio)
      : { inicio: input.inicio, fim: input.fim };

  if (input.campanhaId !== null) {
    const campanha = await campaignRepository.findById(input.campanhaId);
    if (!campanha) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CAMPANHA_NAO_ENCONTRADA, 400);
    }
    const periodoDaCampanha = { inicio: dataDaColunaDate(campanha.inicio), fim: dataDaColunaDate(campanha.fim) };
    if (!metaDentroDaCampanha({ inicio, fim }, periodoDaCampanha)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_FORA_DA_CAMPANHA, 400);
    }
  }

  return {
    representanteId: representante.id,
    periodo: input.periodo,
    inicio: colunaDateDaData(inicio),
    fim: colunaDateDaData(fim),
    metaVisitas: input.metaVisitas,
    metaVendas: input.metaVendas,
    campanhaId: input.campanhaId,
  };
}

async function exigirMeta(id: string): Promise<Goal> {
  const meta = await goalRepository.findById(id);
  if (!meta) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_META_NAO_ENCONTRADA, 404);
  }
  return meta;
}

/**
 * Sem `campanhaId`, só as metas sem campanha; com ele, só as daquela
 * campanha. O representante recebe só as próprias (o `representanteId`
 * pedido é ignorado); o gestor, as do representante pedido ou todas. Com
 * período na query (dias ou datas, sem teto), só as metas que cruzam a
 * janela; sem período, todas.
 */
export async function listarMetas(usuario: UsuarioAutenticado, filtro: ListarMetasQuery): Promise<MetaDTO[]> {
  const pediuPeriodo = filtro.periodoDias !== undefined || filtro.inicio !== undefined || filtro.fim !== undefined;
  const janela = pediuPeriodo ? resolverPeriodo(filtro, new Date()) : undefined;

  const metas = await goalRepository.listar({
    campanhaId: filtro.campanhaId ?? null,
    representanteId: representanteEfetivo(usuario, filtro.representanteId),
    ...(janela ? { janela: { inicio: colunaDateDaData(janela.inicio), fim: colunaDateDaData(janela.fim) } } : {}),
  });
  return montarDTOs(metas);
}

export async function criarMeta(input: MetaInput): Promise<MetaDTO> {
  const criada = await goalRepository.create(await dadosDaMeta(input));
  return montarDTO(criada);
}

/** Troca a meta inteira (o `PUT` manda todos os campos). */
export async function atualizarMeta(id: string, input: MetaInput): Promise<MetaDTO> {
  const existente = await exigirMeta(id);
  const atualizada = await goalRepository.update(id, await dadosDaMeta(input, existente));
  return montarDTO(atualizada);
}

export async function excluirMeta(id: string): Promise<void> {
  await exigirMeta(id);
  await goalRepository.remove(id);
}
