import type { Campaign, TipoCampanha } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as campaignRepository from '../repositories/campaign.repository';
import type { CampanhaData } from '../repositories/campaign.repository';
import * as userRepository from '../repositories/user.repository';
import type { CampanhaInput } from '../schemas/campaign.schema';
import type { UsuarioAutenticado } from './carteira';
import {
  resultadosDaCampanha,
  statusDaCampanha,
  type Pessoa,
  type ResultadoDoRepresentante,
  type StatusCampanha,
  type VisitaVinculada,
} from './campaign.regras';
import { colunaDateDaData, dataCalendario, dataDaColunaDate } from './classificacao.service';
import { buscarProduto } from './erp.service';

/**
 * Campanhas, promoções e eventos (spec 7.7). Todos leem; só o gestor cria,
 * altera e exclui (barrado nas rotas). O status sai do dia de hoje em São
 * Paulo; as vendas vinculadas, das visitas com a campanha.
 */

const MENSAGEM_CAMPANHA_NAO_ENCONTRADA = 'Campanha não encontrada.';
const MENSAGEM_PRODUTO_DESCONHECIDO = 'Produto não encontrado no catálogo.';
const MENSAGEM_CAMPANHA_ENCERRADA_OU_INEXISTENTE = 'Campanha encerrada ou inexistente.';

export type CampanhaDTO = {
  id: string;
  nome: string;
  tipo: TipoCampanha;
  /** `AAAA-MM-DD`, inclusivo. */
  inicio: string;
  /** `AAAA-MM-DD`, inclusivo. */
  fim: string;
  descricao: string;
  /** Em %; `null` sem desconto. */
  desconto: number | null;
  /** SKUs em destaque com o nome do catálogo (SKU que saiu do catálogo fica com o próprio SKU como nome). */
  produtos: { sku: string; nome: string }[];
  status: StatusCampanha;
  /**
   * Vendas (R$) e visitas vinculadas por representante, por nome. O
   * representante recebe só a própria linha; o gestor, os representantes
   * ativos e quem mais tiver visita vinculada (ex.: um inativado).
   */
  resultados: ResultadoDoRepresentante[];
};

function toCampanhaDTO(
  campanha: Campaign,
  hoje: Date,
  visitas: VisitaVinculada[],
  base: Pessoa[],
): CampanhaDTO {
  const inicio = dataDaColunaDate(campanha.inicio);
  const fim = dataDaColunaDate(campanha.fim);

  return {
    id: campanha.id,
    nome: campanha.nome,
    tipo: campanha.tipo,
    inicio,
    fim,
    descricao: campanha.descricao,
    desconto: campanha.desconto,
    produtos: campanha.produtos.map((sku) => ({ sku, nome: buscarProduto(sku)?.nome ?? sku })),
    status: statusDaCampanha({ inicio, fim }, dataCalendario(hoje)),
    resultados: resultadosDaCampanha(visitas, base),
  };
}

/**
 * Quem aparece nas vendas vinculadas mesmo sem visita: para o gestor, os
 * representantes ativos; para o representante, só ele mesmo. As visitas do
 * representante já vêm filtradas pelo autor.
 */
async function escopoDosResultados(
  usuario: UsuarioAutenticado,
): Promise<{ base: Pessoa[]; autorId?: string }> {
  if (usuario.role === 'GESTOR') {
    return { base: await userRepository.listByRole('REPRESENTANTE') };
  }

  const eu = await userRepository.findById(usuario.id);
  return { base: eu ? [{ id: eu.id, nome: eu.nome }] : [], autorId: usuario.id };
}

/** Uma campanha com as vendas vinculadas no escopo de quem pede. */
async function montarDTO(campanha: Campaign, usuario: UsuarioAutenticado, hoje: Date): Promise<CampanhaDTO> {
  const { base, autorId } = await escopoDosResultados(usuario);
  const visitas = await campaignRepository.listarVisitasVinculadas({ campanhaId: campanha.id, autorId });
  return toCampanhaDTO(campanha, hoje, visitas, base);
}

/** SKUs do catálogo do ERP (400 no primeiro desconhecido) e datas como colunas `@db.Date`. */
function dadosDaCampanha(input: CampanhaInput): CampanhaData {
  for (const sku of input.produtos) {
    if (!buscarProduto(sku)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_PRODUTO_DESCONHECIDO, 400);
    }
  }

  return {
    nome: input.nome,
    tipo: input.tipo,
    inicio: colunaDateDaData(input.inicio),
    fim: colunaDateDaData(input.fim),
    descricao: input.descricao,
    desconto: input.desconto,
    produtos: input.produtos,
  };
}

async function exigirCampanha(id: string): Promise<Campaign> {
  const campanha = await campaignRepository.findById(id);
  if (!campanha) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CAMPANHA_NAO_ENCONTRADA, 404);
  }
  return campanha;
}

/** Todas, em ordem de início, com status e vendas vinculadas no escopo de quem pede. */
export async function listarCampanhas(usuario: UsuarioAutenticado, hoje: Date = new Date()): Promise<CampanhaDTO[]> {
  const { base, autorId } = await escopoDosResultados(usuario);
  const [campanhas, visitas] = await Promise.all([
    campaignRepository.listar(),
    campaignRepository.listarVisitasVinculadas({ autorId }),
  ]);

  const visitasPorCampanha = new Map<string, VisitaVinculada[]>();
  for (const visita of visitas) {
    visitasPorCampanha.set(visita.campanhaId, [...(visitasPorCampanha.get(visita.campanhaId) ?? []), visita]);
  }

  return campanhas.map((campanha) => toCampanhaDTO(campanha, hoje, visitasPorCampanha.get(campanha.id) ?? [], base));
}

export async function criarCampanha(input: CampanhaInput, usuario: UsuarioAutenticado): Promise<CampanhaDTO> {
  const criada = await campaignRepository.create(dadosDaCampanha(input));
  return montarDTO(criada, usuario, new Date());
}

/** Troca a campanha inteira (o `PUT` manda todos os campos). */
export async function atualizarCampanha(
  id: string,
  input: CampanhaInput,
  usuario: UsuarioAutenticado,
): Promise<CampanhaDTO> {
  await exigirCampanha(id);
  const atualizada = await campaignRepository.update(id, dadosDaCampanha(input));
  return montarDTO(atualizada, usuario, new Date());
}

/** Visitas e próximas visitas vinculadas ficam sem campanha; nada mais muda. */
export async function excluirCampanha(id: string): Promise<void> {
  await exigirCampanha(id);
  await campaignRepository.remove(id);
}

/**
 * Check-in (spec 7.7): a visita e a próxima visita só se vinculam a
 * campanha que existe e não está encerrada no dia de hoje em São Paulo
 * (programada ou em andamento). Senão, 400.
 */
export async function exigirCampanhaNaoEncerrada(id: string, hoje: Date = new Date()): Promise<void> {
  const campanha = await campaignRepository.findById(id);
  const encerrada =
    !campanha ||
    statusDaCampanha(
      { inicio: dataDaColunaDate(campanha.inicio), fim: dataDaColunaDate(campanha.fim) },
      dataCalendario(hoje),
    ) === 'ENCERRADA';

  if (encerrada) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CAMPANHA_ENCERRADA_OU_INEXISTENTE, 400);
  }
}
