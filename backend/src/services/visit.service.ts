import { Prisma, type ResultadoVisita } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { detectarImagem } from '../lib/imageType';
import { fileStorage } from '../storage';
import * as clientRepository from '../repositories/client.repository';
import * as visitRepository from '../repositories/visit.repository';
import type {
  ItemDoPedidoData,
  ProximaVisitaDoClienteData,
  VisitComCarteira,
  VisitComRelacoes,
} from '../repositories/visit.repository';
import type { CreateVisitInput, UpdateVisitInput } from '../schemas/visit.schema';
import { exigirCampanhaNaoEncerrada } from './campaign.service';
import { ehDeOutraCarteira, exigirClienteDaCarteira, exigirClienteVisivel, type UsuarioAutenticado } from './carteira';
import { colunaDateDaData } from './classificacao.service';
import { buscarProduto } from './erp.service';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const MENSAGEM_CLIENTE_INATIVO = 'Cliente inativo não recebe check-in.';
const MENSAGEM_CONTATO_DE_OUTRO_CLIENTE = 'Contato informado não pertence a este cliente.';
const MENSAGEM_PEDIDO_SEM_VENDA = 'Pedido só pode ser registrado em visita com venda.';
const MENSAGEM_PRODUTO_DESCONHECIDO = 'Produto não encontrado no catálogo.';
const MENSAGEM_VISITA_NAO_ENCONTRADA = 'Visita não encontrada.';
const MENSAGEM_APENAS_AUTOR = 'Apenas o autor do check-in pode alterá-lo.';
const MENSAGEM_FOTO_JA_EXISTE = 'Esta visita já tem foto de comprovação.';
const MENSAGEM_FOTO_INVALIDA = 'O arquivo enviado não é uma imagem JPEG, PNG ou WebP.';
const MENSAGEM_SEM_FOTO = 'Esta visita não tem foto de comprovação.';

export type ItemDoPedidoDTO = {
  sku: string;
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
};

export type VisitaDTO = {
  id: string;
  dataHora: string;
  descricao: string;
  resultado: ResultadoVisita;
  contato: { id: string; nome: string } | null;
  autor: { id: string; nome: string };
  temFoto: boolean;
  criadoEm: string;
  editadoEm: string | null;
  /** Pedido da visita (vazio sem pedido), com o preço gravado no check-in. */
  itens: ItemDoPedidoDTO[];
  /** Soma de quantidade × preço unitário dos itens, em reais com 2 casas. */
  totalPedido: number;
  /** Campanha da visita (spec 7.7); `null` sem campanha ou depois de a campanha ser excluída. */
  campanha: { id: string; nome: string } | null;
};

/**
 * O DTO expõe `temFoto`, e nunca o `fotoPath`: a chave interna do
 * armazenamento não é assunto do cliente HTTP — a foto é lida pela rota
 * `GET /visits/:id/foto`, autenticada como as demais.
 *
 * O total é somado em `Decimal` (o tipo da coluna) e só no fim vira
 * `number`: em ponto flutuante, 3 × 27,90 daria 83,69999….
 */
export function toVisitaDTO(visit: VisitComRelacoes): VisitaDTO {
  const totalPedido = visit.itens.reduce(
    (soma, item) => soma.plus(item.precoUnitario.times(item.quantidade)),
    new Prisma.Decimal(0),
  );

  return {
    id: visit.id,
    dataHora: visit.dataHora.toISOString(),
    descricao: visit.descricao,
    resultado: visit.resultado,
    contato: visit.contact ? { id: visit.contact.id, nome: visit.contact.nome } : null,
    autor: { id: visit.user.id, nome: visit.user.nome },
    temFoto: visit.fotoPath !== null,
    criadoEm: visit.criadoEm.toISOString(),
    editadoEm: visit.editadoEm ? visit.editadoEm.toISOString() : null,
    itens: visit.itens.map((item) => ({
      sku: item.sku,
      produtoNome: item.produtoNome,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario.toDecimalPlaces(2).toNumber(),
    })),
    totalPedido: totalPedido.toDecimalPlaces(2).toNumber(),
    campanha: visit.campanha ? { id: visit.campanha.id, nome: visit.campanha.nome } : null,
  };
}

/**
 * Linhas do pedido com nome e preço do catálogo do ERP, nunca do corpo da
 * requisição (spec 7.5). Pedido só em visita com venda; linhas do mesmo SKU
 * viram uma só, com as quantidades somadas. Lista vazia é "sem pedido".
 */
function montarItensDoPedido(
  itens: CreateVisitInput['itens'],
  resultado: ResultadoVisita,
): ItemDoPedidoData[] {
  if (!itens || itens.length === 0) return [];

  if (resultado !== 'VENDA') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_PEDIDO_SEM_VENDA, 400);
  }

  const quantidadePorSku = new Map<string, number>();
  for (const item of itens) {
    quantidadePorSku.set(item.sku, (quantidadePorSku.get(item.sku) ?? 0) + item.quantidade);
  }

  return [...quantidadePorSku].map(([sku, quantidade]) => {
    const produto = buscarProduto(sku);
    if (!produto) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_PRODUTO_DESCONHECIDO, 400);
    }
    return { sku, produtoNome: produto.nome, quantidade, precoUnitario: produto.precoUnitario };
  });
}

/**
 * Próxima visita e campanha da próxima visita que o check-in grava no
 * cliente (spec 7.4 e 7.7). A visita nova substitui a data marcada antes
 * (ruling R22): sem data (`null` ou campo ausente), apaga a data e a
 * campanha e a agenda volta à recorrência — uma data antiga, talvez
 * vencida, deixaria o cliente recém-visitado como atrasado; e campanha sem
 * data não vale. Com data, a campanha é a do corpo (ausente: nenhuma). O
 * lembrete não mora mais no cliente (Etapa 9): é criado à parte, com a data
 * dele, e sobrevive à data apagada.
 */
function montarProximaVisitaDoCliente(input: CreateVisitInput): ProximaVisitaDoClienteData {
  if (input.proximaVisita === null || input.proximaVisita === undefined) {
    return { proximaVisita: null, proximaCampanhaId: null };
  }

  return {
    proximaVisita: colunaDateDaData(input.proximaVisita),
    proximaCampanhaId: input.proximaCampanhaId ?? null,
  };
}

/**
 * Check-in novo exige, nesta ordem: cliente existe (404) -> é da carteira
 * do representante (403) -> está ativo (409).
 */
async function exigirClienteAtivoDaCarteira(clientId: string, usuario: UsuarioAutenticado): Promise<void> {
  const cliente = await clientRepository.findById(clientId);

  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  exigirClienteDaCarteira(cliente, usuario);

  if (!cliente.ativo) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_CLIENTE_INATIVO, 409);
  }
}

/**
 * A leitura da timeline **não** exige cliente ativo: o histórico de um
 * cliente inativado continua legível (e editável pelo autor); o que se
 * bloqueia é check-in novo em carteira desativada. Cliente de outra
 * carteira responde ao representante como inexistente (404).
 */
export async function listVisitsByClient(clientId: string, usuario: UsuarioAutenticado): Promise<VisitaDTO[]> {
  exigirClienteVisivel(await clientRepository.findById(clientId), usuario);

  const visitas = await visitRepository.listByClient(clientId);
  return visitas.map(toVisitaDTO);
}

export async function createVisit(
  clientId: string,
  usuario: UsuarioAutenticado,
  input: CreateVisitInput,
): Promise<VisitaDTO> {
  await exigirClienteAtivoDaCarteira(clientId, usuario);

  if (input.contactId) {
    const pertence = await visitRepository.contatoPertenceAoCliente(input.contactId, clientId);
    if (!pertence) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CONTATO_DE_OUTRO_CLIENTE, 400);
    }
  }

  const itens = montarItensDoPedido(input.itens, input.resultado);
  const proximaVisitaDoCliente = montarProximaVisitaDoCliente(input);
  const campanhaId = input.campanhaId ?? null;

  // Campanha encerrada ou inexistente: 400 antes de gravar qualquer coisa
  if (campanhaId) await exigirCampanhaNaoEncerrada(campanhaId);
  if (proximaVisitaDoCliente.proximaCampanhaId) {
    await exigirCampanhaNaoEncerrada(proximaVisitaDoCliente.proximaCampanhaId);
  }

  const visita = await visitRepository.create({
    clientId,
    userId: usuario.id,
    contactId: input.contactId,
    campanhaId,
    dataHora: input.dataHora ?? new Date(),
    descricao: input.descricao,
    resultado: input.resultado,
    itens,
    proximaVisitaDoCliente,
    lembrete: input.lembrete
      ? { texto: input.lembrete.texto, data: colunaDateDaData(input.lembrete.data) }
      : undefined,
  });

  return toVisitaDTO(visita);
}

/**
 * Alterar um check-in exige, nesta ordem: visita existe (404) -> é do autor
 * (403) -> o cliente ainda é da carteira dele (403; o cliente pode ter sido
 * transferido depois do check-in).
 */
async function exigirVisitaDoAutor(visitId: string, usuario: UsuarioAutenticado): Promise<VisitComCarteira> {
  const visita = await visitRepository.findById(visitId);

  if (!visita) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_VISITA_NAO_ENCONTRADA, 404);
  }

  if (visita.userId !== usuario.id) {
    throw new AppError(ErrorCode.FORBIDDEN, MENSAGEM_APENAS_AUTOR, 403);
  }

  exigirClienteDaCarteira(visita.client, usuario);

  return visita;
}

export async function updateDescricao(
  visitId: string,
  usuario: UsuarioAutenticado,
  input: UpdateVisitInput,
): Promise<VisitaDTO> {
  await exigirVisitaDoAutor(visitId, usuario);

  const visita = await visitRepository.updateDescricao(visitId, input.descricao);
  return toVisitaDTO(visita);
}

export async function anexarFoto(visitId: string, usuario: UsuarioAutenticado, conteudo: Buffer): Promise<VisitaDTO> {
  const visita = await exigirVisitaDoAutor(visitId, usuario);

  if (visita.fotoPath !== null) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_FOTO_JA_EXISTE, 409);
  }

  const formato = detectarImagem(conteudo);
  if (!formato) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_FOTO_INVALIDA, 400);
  }

  const chave = `visits/${visitId}.${formato.extensao}`;
  await fileStorage.save(chave, conteudo, formato.contentType);

  const atualizada = await visitRepository.setFotoPath(visitId, chave);
  return toVisitaDTO(atualizada);
}

/** Visita de cliente de outra carteira responde ao representante como inexistente (404). */
export async function lerFoto(
  visitId: string,
  usuario: UsuarioAutenticado,
): Promise<{ conteudo: Buffer; contentType: string }> {
  const visita = await visitRepository.findById(visitId);

  if (!visita || ehDeOutraCarteira(visita.client, usuario)) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_VISITA_NAO_ENCONTRADA, 404);
  }

  if (visita.fotoPath === null) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_SEM_FOTO, 404);
  }

  // Arquivo ausente no armazenamento (volume novo, restauração só do
  // banco) já chega como AppError 404 do driver — não vaza como 500.
  return fileStorage.read(visita.fotoPath);
}
