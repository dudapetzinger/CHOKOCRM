import { Prisma, type Role, type User } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { logger } from '../lib/logger';
import { emailProvider } from '../providers/email';
import * as clientRepository from '../repositories/client.repository';
import * as userRepository from '../repositories/user.repository';
import type { UsuarioComCarteira } from '../repositories/user.repository';
import type { CreateUserInput, UpdateUserInput } from '../schemas/user.schema';
import { hashDaSenha } from './auth.service';
import type { UsuarioAutenticado } from './carteira';
import { emailDeRedefinicaoDeSenha } from './email.templates';
import { expiracaoDoToken, gerarTokenDeRedefinicao } from './redefinicao-senha.regras';

/**
 * Gestão de usuários pelo gestor (spec da Etapa 8, 7.13). Quem pode chamar
 * já foi barrado nas rotas (`requireRole('GESTOR')`); aqui ficam as regras
 * que dependem de quem é o alvo.
 */

const MENSAGEM_USUARIO_NAO_ENCONTRADO = 'Usuário não encontrado.';
const MENSAGEM_EMAIL_DUPLICADO = 'Já existe um usuário com este e-mail.';
const MENSAGEM_INATIVAR_A_SI_MESMO = 'Você não pode inativar a própria conta.';
const MENSAGEM_MUDAR_O_PROPRIO_PAPEL = 'Você não pode mudar o próprio papel.';
const MENSAGEM_TRANSFIRA_ANTES = 'Transfira a carteira antes de mudar o papel.';
const MENSAGEM_REPRESENTANTE_INVALIDO = 'Representante informado não existe ou não é representante.';
const MENSAGEM_REPRESENTANTE_INATIVO = 'Representante inativo.';
const MENSAGEM_DESTINO_IGUAL_A_ORIGEM = 'Escolha outro representante para receber a carteira.';
const MENSAGEM_REATIVE_ANTES = 'Reative a conta antes de redefinir a senha.';
const MENSAGEM_EMAIL_NAO_CONFIGURADO = 'Envio de e-mail não configurado.';
const MENSAGEM_FALHA_NO_ENVIO = 'Não foi possível enviar o e-mail.';

export type UsuarioDTO = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: Role;
  ativo: boolean;
  criadoEm: string;
  /** Clientes **ativos** cuja carteira é dele. */
  clientesNaCarteira: number;
};

function toUsuarioDTO(usuario: UsuarioComCarteira): UsuarioDTO {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    role: usuario.role,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm.toISOString(),
    clientesNaCarteira: usuario._count.clients,
  };
}

function erroEmailDuplicado(): AppError {
  return new AppError(ErrorCode.CONFLICT, MENSAGEM_EMAIL_DUPLICADO, 409);
}

/**
 * A checagem prévia (`exigirEmailLivre`) dá a mensagem certa no caso comum;
 * esta tradução cobre a corrida em que dois cadastros com o mesmo e-mail
 * chegam juntos e o índice único do banco recusa o segundo.
 */
function traduzirEmailDuplicado(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return erroEmailDuplicado();
  }
  return err;
}

/** E-mail (já em minúsculas) livre, ou do próprio usuário que está sendo editado. */
async function exigirEmailLivre(email: string, idDoProprio?: string): Promise<void> {
  const dono = await userRepository.findByEmail(email);
  if (dono && dono.id !== idDoProprio) {
    throw erroEmailDuplicado();
  }
}

async function exigirUsuario(id: string): Promise<User> {
  const usuario = await userRepository.findById(id);
  if (!usuario) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_USUARIO_NAO_ENCONTRADO, 404);
  }
  return usuario;
}

async function obterUsuario(id: string): Promise<UsuarioDTO> {
  const usuario = await userRepository.findByIdComCarteira(id);
  if (!usuario) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_USUARIO_NAO_ENCONTRADO, 404);
  }
  return toUsuarioDTO(usuario);
}

/** Tela de Usuários: todos, ativos e inativos, por nome. */
export async function listarUsuarios(): Promise<UsuarioDTO[]> {
  const usuarios = await userRepository.listComCarteira();
  return usuarios.map(toUsuarioDTO);
}

/** Seletor de representante do gestor: só os ativos (id e nome), por nome. */
export async function listarRepresentantesAtivos(): Promise<{ id: string; nome: string }[]> {
  return userRepository.listByRole('REPRESENTANTE');
}

export async function criarUsuario(input: CreateUserInput): Promise<UsuarioDTO> {
  await exigirEmailLivre(input.email);

  try {
    const criado = await userRepository.create({
      nome: input.nome,
      email: input.email,
      telefone: input.telefone ?? null,
      role: input.role,
      senhaHash: await hashDaSenha(input.senha),
    });
    return await obterUsuario(criado.id);
  } catch (err) {
    throw traduzirEmailDuplicado(err);
  }
}

/**
 * Edição pelo gestor. Ninguém inativa a própria conta nem muda o próprio
 * papel; representante com clientes ativos na carteira só vira gestor
 * depois de transferi-los (os inativos a transferência também leva).
 */
export async function atualizarUsuario(
  id: string,
  input: UpdateUserInput,
  autor: UsuarioAutenticado,
): Promise<UsuarioDTO> {
  const alvo = await userRepository.findByIdComCarteira(id);
  if (!alvo) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_USUARIO_NAO_ENCONTRADO, 404);
  }

  const ehAPropriaConta = alvo.id === autor.id;
  const mudaPapel = input.role !== undefined && input.role !== alvo.role;

  if (ehAPropriaConta && input.ativo === false) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_INATIVAR_A_SI_MESMO, 400);
  }

  if (ehAPropriaConta && mudaPapel) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_MUDAR_O_PROPRIO_PAPEL, 400);
  }

  if (mudaPapel && alvo.role === 'REPRESENTANTE' && alvo._count.clients > 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_TRANSFIRA_ANTES, 400);
  }

  if (input.email !== undefined) {
    await exigirEmailLivre(input.email, alvo.id);
  }

  // Inativar a conta ou trocar o e-mail (o link foi para o endereço antigo)
  // tira a validade dos links de redefinição abertos.
  const invalidarLinksDeRedefinicao =
    input.ativo === false || (input.email !== undefined && input.email !== alvo.email);

  try {
    await userRepository.update(id, input, { invalidarLinksDeRedefinicao });
  } catch (err) {
    throw traduzirEmailDuplicado(err);
  }

  return obterUsuario(id);
}

/**
 * Passa todos os clientes (ativos e inativos) de um usuário para um
 * representante ativo. A origem pode estar inativa: é o caso comum de
 * inativar e depois transferir.
 */
export async function transferirCarteira(origemId: string, destinoId: string): Promise<{ transferidos: number }> {
  await exigirUsuario(origemId);

  if (destinoId === origemId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_DESTINO_IGUAL_A_ORIGEM, 400);
  }

  const destino = await userRepository.findById(destinoId);
  if (!destino || destino.role !== 'REPRESENTANTE') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_REPRESENTANTE_INVALIDO, 400);
  }

  if (!destino.ativo) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_REPRESENTANTE_INATIVO, 400);
  }

  const transferidos = await clientRepository.transferirCarteira(origemId, destinoId);
  return { transferidos };
}

/** Só o que ajuda a diagnosticar: nada do conteúdo da mensagem nem das credenciais. */
function resumoDoErroDeEnvio(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { erro: String(err) };
  }
  const { code, responseCode } = err as Error & { code?: unknown; responseCode?: unknown };
  return { nome: err.name, mensagem: err.message, code, responseCode };
}

/**
 * Manda ao e-mail de cadastro da pessoa um link para ela mesma definir a
 * senha nova. Sem provedor de e-mail (produção sem SMTP), 503 antes de
 * gravar qualquer token.
 *
 * Ordem: grava o link novo, envia e só então invalida os anteriores. Se o
 * envio falha, o link novo (que ninguém recebeu) é descartado e os
 * anteriores continuam valendo — a pessoa nunca fica sem link por causa de
 * uma falha do SMTP — e a resposta é 503. Entre a gravação e o fim do envio
 * os dois links valem por alguns segundos, ambos na caixa da própria pessoa.
 */
export async function enviarRedefinicaoDeSenha(id: string): Promise<void> {
  const usuario = await exigirUsuario(id);

  if (!usuario.ativo) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_REATIVE_ANTES, 400);
  }

  const provedor = emailProvider;
  if (!provedor) {
    throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, MENSAGEM_EMAIL_NAO_CONFIGURADO, 503);
  }

  const { token, tokenHash } = gerarTokenDeRedefinicao();
  const novo = await userRepository.createTokenDeRedefinicao({
    userId: usuario.id,
    tokenHash,
    expiraEm: expiracaoDoToken(new Date()),
  });

  try {
    await provedor.enviar(
      emailDeRedefinicaoDeSenha({ para: usuario.email, nome: usuario.nome, appUrl: env.APP_URL, token }),
    );
  } catch (err) {
    logger.error(
      { userId: usuario.id, erro: resumoDoErroDeEnvio(err) },
      'Falha ao enviar o e-mail de redefinição de senha',
    );
    // Se nem o descarte gravar, o link novo fica aberto, mas ninguém o recebeu.
    await userRepository.descartarTokenDeRedefinicao(novo.id, new Date()).catch((erroDoDescarte: unknown) => {
      logger.error({ userId: usuario.id, err: erroDoDescarte }, 'Falha ao descartar o link não enviado');
    });
    throw new AppError(ErrorCode.SERVICE_UNAVAILABLE, MENSAGEM_FALHA_NO_ENVIO, 503);
  }

  await userRepository.invalidarLinksAnteriores({ userId: usuario.id, novo, agora: new Date() });
}
