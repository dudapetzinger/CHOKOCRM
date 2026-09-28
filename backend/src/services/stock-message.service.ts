import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import * as stockMessageRepository from '../repositories/stock-message.repository';
import * as userRepository from '../repositories/user.repository';
import * as visitRepository from '../repositories/visit.repository';
import type { GerarMensagemInput } from '../schemas/stock-message.schema';
import type { UsuarioAutenticado } from './client.service';
import { eventoVigente } from './seasonal-event.service';
import { montarLinkWhatsapp, montarMensagemDeEstoque, normalizarTelefone } from './stock-message.template';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';
const MENSAGEM_CLIENTE_INATIVO = 'Cliente inativo não recebe mensagem de estoque.';
const MENSAGEM_CONTATO_NAO_PERTENCE = 'Contato informado não pertence a este cliente.';
const MENSAGEM_TELEFONE_INVALIDO = 'Telefone inválido para gerar o link do WhatsApp.';

/** Nome do evento no template (sem o ano): o DB grava "Páscoa 2026", o template recebe "Páscoa". */
const REGEX_ANO_FINAL = / \d{4}$/;

function nomeSemAno(nome: string): string {
  return nome.replace(REGEX_ANO_FINAL, '');
}

export type PropostaDTO = {
  evento: { id: string; nome: string; produtosSugeridos: string[] } | null;
  contatos: { id: string; nome: string; telefone: string; principal: boolean }[];
  telefoneCliente: string;
  textoSugerido: string;
};

export type StockMessageDTO = {
  id: string;
  dataGeracao: string;
  textoFinal: string;
  autor: { id: string; nome: string };
  evento: { id: string; nome: string } | null;
  cliente: { id: string; nomeFantasia: string };
};

export type GeracaoDTO = StockMessageDTO & {
  contato: { id: string; nome: string } | null;
  telefone: string;
  link: string;
};

/**
 * Proposta de mensagem de estoque (UC12, antes de gravar): não escreve
 * nada, apenas monta o texto sugerido a partir do cliente, do evento
 * sazonal vigente (se houver) e do nome do usuário logado.
 */
export async function propor(
  clientId: string,
  usuario: UsuarioAutenticado,
  hoje: Date = new Date(),
): Promise<PropostaDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  const usuarioLogado = await userRepository.findById(usuario.id);
  const evento = await eventoVigente(hoje);

  const contatoPrincipal = cliente.contacts.find((contato) => contato.principal) ?? null;

  const textoSugerido = montarMensagemDeEstoque({
    nomeContato: contatoPrincipal?.nome ?? null,
    nomeFantasia: cliente.nomeFantasia,
    nomeRepresentante: usuarioLogado?.nome ?? '',
    evento: evento ? { nome: nomeSemAno(evento.nome), produtosSugeridos: evento.produtosSugeridos } : null,
  });

  return {
    evento: evento ? { id: evento.id, nome: evento.nome, produtosSugeridos: evento.produtosSugeridos } : null,
    contatos: cliente.contacts.map((contato) => ({
      id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      principal: contato.principal,
    })),
    telefoneCliente: cliente.telefone,
    textoSugerido,
  };
}

function paraStockMessageDTO(registro: stockMessageRepository.StockMessageComRelacoes): StockMessageDTO {
  return {
    id: registro.id,
    dataGeracao: registro.dataGeracao.toISOString(),
    textoFinal: registro.textoFinal,
    autor: registro.user,
    evento: registro.eventoSazonal,
    cliente: registro.client,
  };
}

/**
 * Gera e grava a mensagem de estoque (UC12): nada é gravado se qualquer
 * checagem falhar. Ordem das checagens: cliente existe (404) -> ativo
 * (409) -> contato pertence ao cliente (400) -> telefone normalizável
 * (400) -> evento vigente -> grava -> monta o link do WhatsApp.
 */
export async function gerar(
  clientId: string,
  usuario: UsuarioAutenticado,
  input: GerarMensagemInput,
  hoje: Date = new Date(),
): Promise<GeracaoDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  if (!cliente.ativo) {
    throw new AppError(ErrorCode.CONFLICT, MENSAGEM_CLIENTE_INATIVO, 409);
  }

  let contato: { id: string; nome: string; telefone: string } | null = null;
  let telefone = cliente.telefone;

  if (input.contactId) {
    const pertence = await visitRepository.contatoPertenceAoCliente(input.contactId, clientId);
    if (!pertence) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CONTATO_NAO_PERTENCE, 400);
    }

    const contatoEncontrado = cliente.contacts.find((c) => c.id === input.contactId) ?? null;
    contato = contatoEncontrado
      ? { id: contatoEncontrado.id, nome: contatoEncontrado.nome, telefone: contatoEncontrado.telefone }
      : null;
    telefone = contatoEncontrado?.telefone ?? cliente.telefone;
  }

  try {
    normalizarTelefone(telefone);
  } catch {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_TELEFONE_INVALIDO, 400);
  }

  const evento = await eventoVigente(hoje);

  const registro = await stockMessageRepository.create({
    clientId,
    userId: usuario.id,
    eventoSazonalId: evento?.id ?? null,
    textoFinal: input.texto,
    dataGeracao: new Date(),
  });

  const link = montarLinkWhatsapp(telefone, input.texto);

  return {
    ...paraStockMessageDTO(registro),
    contato: contato ? { id: contato.id, nome: contato.nome } : null,
    telefone,
    link,
  };
}

/** Histórico de mensagens geradas (UC12), mais recente primeiro. */
export async function listar(filtro: { clientId?: string }): Promise<StockMessageDTO[]> {
  const registros = await stockMessageRepository.list(filtro);
  return registros.map(paraStockMessageDTO);
}
