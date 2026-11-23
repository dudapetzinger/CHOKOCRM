import type { Campaign, Goal, TipoCampanha } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as campaignRepository from '../repositories/campaign.repository';
import type { CampanhaData, PeriodoDaMetaAjustada } from '../repositories/campaign.repository';
import * as userRepository from '../repositories/user.repository';
import type { CampanhaInput } from '../schemas/campaign.schema';
import type { UsuarioAutenticado } from './carteira';
import {
  produtosMaisVendidos,
  resultadosDaCampanha,
  resumoDaCampanha,
  statusDaCampanha,
  vendasDaCampanha,
  type Pessoa,
  type ProdutoVendido,
  type ResultadoDoRepresentante,
  type ResumoDaCampanha,
  type StatusCampanha,
  type VendaDaCampanha,
  type VisitaVinculada,
} from './campaign.regras';
import {
  colunaDateDaData,
  dataCalendario,
  dataDaColunaDate,
  somarDias,
  type DataCalendario,
} from './classificacao.service';
import { buscarProduto, listarProdutos } from './erp.service';
import { ajustarMetaAoPeriodo } from './goal.regras';
import { agora } from '../lib/relogio';

/**
 * Campanhas, promoções e eventos. Todos leem; só o gestor cria,
 * altera, encerra e exclui (barrado nas rotas). O status sai do dia de hoje
 * em São Paulo; os resultados, o resumo, os produtos mais vendidos e as
 * vendas, das visitas com a campanha.
 */

const MENSAGEM_CAMPANHA_NAO_ENCONTRADA = 'Campanha não encontrada.';
const MENSAGEM_PRODUTO_DESCONHECIDO = 'Produto não encontrado no catálogo.';
const MENSAGEM_CAMPANHA_ENCERRADA_OU_INEXISTENTE = 'Campanha encerrada ou inexistente.';
const MENSAGEM_SO_EM_ANDAMENTO = 'Só uma campanha em andamento pode ser encerrada.';
const MENSAGEM_COMECOU_HOJE = 'A campanha começou hoje. Para desistir dela, edite as datas ou exclua a campanha.';

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
   * Visitas, clientes atendidos, vendas (R$) e conversão vinculados por
   * representante, por nome. O representante recebe só a própria linha; o
   * gestor, os representantes ativos e quem mais tiver visita vinculada
   * (ex.: um inativado).
   */
  resultados: ResultadoDoRepresentante[];
  /** Os 5 produtos mais vendidos nas visitas vinculadas, no escopo de quem pede (o representante vê só os dele). */
  produtosMaisVendidos: ProdutoVendido[];
  /**
   * Uma linha por visita vinculada com VENDA (cliente, representante, itens
   * e total), da mais recente para a mais antiga, no escopo de quem pede (o
   * representante vê só as dele).
   */
  vendas: VendaDaCampanha[];
  /** Os totais da campanha (visitas, vendas, clientes, conversão e valor médio), no escopo de quem pede. */
  resumo: ResumoDaCampanha;
};

/** Nome de cada SKU do catálogo do ERP, para exibir os produtos das campanhas. */
async function nomesDoCatalogo(): Promise<Map<string, string>> {
  return new Map((await listarProdutos()).map(({ sku, nome }) => [sku, nome]));
}

function toCampanhaDTO(
  campanha: Campaign,
  hoje: Date,
  visitas: VisitaVinculada[],
  base: Pessoa[],
  catalogo: Map<string, string>,
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
    produtos: campanha.produtos.map((sku) => ({ sku, nome: catalogo.get(sku) ?? sku })),
    status: statusDaCampanha({ inicio, fim }, dataCalendario(hoje)),
    resultados: resultadosDaCampanha(visitas, base),
    produtosMaisVendidos: produtosMaisVendidos(visitas),
    vendas: vendasDaCampanha(visitas),
    resumo: resumoDaCampanha(visitas),
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
  const [visitas, catalogo] = await Promise.all([
    campaignRepository.listarVisitasVinculadas({ campanhaId: campanha.id, autorId }),
    nomesDoCatalogo(),
  ]);
  return toCampanhaDTO(campanha, hoje, visitas, base, catalogo);
}

/** SKUs do catálogo do ERP (400 no primeiro desconhecido) e datas como colunas `@db.Date`. */
async function dadosDaCampanha(input: CampanhaInput): Promise<CampanhaData> {
  for (const sku of input.produtos) {
    if (!(await buscarProduto(sku))) {
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
export async function listarCampanhas(usuario: UsuarioAutenticado, hoje: Date = agora()): Promise<CampanhaDTO[]> {
  const { base, autorId } = await escopoDosResultados(usuario);
  const [campanhas, visitas, catalogo] = await Promise.all([
    campaignRepository.listar(),
    campaignRepository.listarVisitasVinculadas({ autorId }),
    nomesDoCatalogo(),
  ]);

  const visitasPorCampanha = new Map<string, VisitaVinculada[]>();
  for (const visita of visitas) {
    visitasPorCampanha.set(visita.campanhaId, [...(visitasPorCampanha.get(visita.campanhaId) ?? []), visita]);
  }

  return campanhas.map((campanha) =>
    toCampanhaDTO(campanha, hoje, visitasPorCampanha.get(campanha.id) ?? [], base, catalogo),
  );
}

export async function criarCampanha(input: CampanhaInput, usuario: UsuarioAutenticado): Promise<CampanhaDTO> {
  const criada = await campaignRepository.create(await dadosDaCampanha(input));
  return montarDTO(criada, usuario, agora());
}

/**
 * Das metas de uma campanha, as que mudam de data para caber no novo
 * período dela (`ajustarMetaAoPeriodo`), já com as datas novas. O
 * repositório chama esta função dentro da transação que grava a campanha.
 */
function metasAjustadasAoPeriodo(
  metas: Goal[],
  periodo: { inicio: DataCalendario; fim: DataCalendario },
): PeriodoDaMetaAjustada[] {
  return metas.flatMap((meta) => {
    const atual = { inicio: dataDaColunaDate(meta.inicio), fim: dataDaColunaDate(meta.fim) };
    const ajustada = ajustarMetaAoPeriodo(atual, periodo);
    const mudou = ajustada.inicio !== atual.inicio || ajustada.fim !== atual.fim;

    return mudou
      ? [{ id: meta.id, inicio: colunaDateDaData(ajustada.inicio), fim: colunaDateDaData(ajustada.fim) }]
      : [];
  });
}

/**
 * Troca a campanha inteira (o `PUT` manda todos os campos). Se as datas
 * mudaram, as metas da campanha são ajustadas para caber no novo período.
 */
export async function atualizarCampanha(
  id: string,
  input: CampanhaInput,
  usuario: UsuarioAutenticado,
): Promise<CampanhaDTO> {
  await exigirCampanha(id);
  const dados = await dadosDaCampanha(input);
  const atualizada = await campaignRepository.updateComMetas(id, dados, (metas) =>
    metasAjustadasAoPeriodo(metas, { inicio: input.inicio, fim: input.fim }),
  );
  return montarDTO(atualizada, usuario, agora());
}

/**
 * Encerra agora uma campanha em andamento: a data de fim passa a ser ontem
 * (o dia do fim ainda conta como dia de campanha, então só com o fim em
 * ontem ela sai como encerrada hoje). As metas dela acompanham o novo fim.
 * As visitas já vinculadas continuam na campanha, para a análise. A
 * campanha que começou hoje não pode ser encerrada, porque o fim ficaria
 * antes do início.
 */
export async function encerrarCampanha(
  id: string,
  usuario: UsuarioAutenticado,
  hoje: Date = agora(),
): Promise<CampanhaDTO> {
  const campanha = await exigirCampanha(id);
  const diaDeHoje = dataCalendario(hoje);
  const inicio = dataDaColunaDate(campanha.inicio);
  const fim = dataDaColunaDate(campanha.fim);

  if (statusDaCampanha({ inicio, fim }, diaDeHoje) !== 'EM_ANDAMENTO') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_SO_EM_ANDAMENTO, 400);
  }
  if (inicio === diaDeHoje) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_COMECOU_HOJE, 400);
  }

  const ontem = somarDias(diaDeHoje, -1);
  const encerrada = await campaignRepository.updateComMetas(id, { fim: colunaDateDaData(ontem) }, (metas) =>
    metasAjustadasAoPeriodo(metas, { inicio, fim: ontem }),
  );
  return montarDTO(encerrada, usuario, hoje);
}

/** Visitas e próximas visitas vinculadas ficam sem campanha; nada mais muda. */
export async function excluirCampanha(id: string): Promise<void> {
  await exigirCampanha(id);
  await campaignRepository.remove(id);
}

/**
 * Check-in: a visita e a próxima visita só se vinculam a
 * campanha que existe e não está encerrada no dia de hoje em São Paulo
 * (programada ou em andamento). Senão, 400.
 */
export async function exigirCampanhaNaoEncerrada(id: string, hoje: Date = agora()): Promise<void> {
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
