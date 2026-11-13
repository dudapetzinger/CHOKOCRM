import { Prisma, type Role, type User } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import * as userRepository from '../repositories/user.repository';
import type { UsuarioComCarteira } from '../repositories/user.repository';
import type { CreateUserInput, UpdateUserInput } from '../schemas/user.schema';
import { hashDaSenha } from './auth.service';
import type { UsuarioAutenticado } from './carteira';

/**
 * Gestão de usuários pelo gestor. Quem pode chamar
 * já foi barrado nas rotas (`requireRole('GESTOR')`); aqui ficam as regras
 * que dependem de quem é o alvo. O app não manda e-mail: senha esquecida
 * volta pela senha provisória que o gestor define (`definirSenhaProvisoria`).
 */

const MENSAGEM_USUARIO_NAO_ENCONTRADO = 'Usuário não encontrado.';
const MENSAGEM_USUARIO_DUPLICADO = 'Já existe uma conta com este usuário.';
const MENSAGEM_INATIVAR_A_SI_MESMO = 'Você não pode inativar a própria conta.';
const MENSAGEM_MUDAR_O_PROPRIO_PAPEL = 'Você não pode mudar o próprio papel.';
const MENSAGEM_TRANSFIRA_ANTES = 'Transfira a carteira antes de mudar o papel.';
const MENSAGEM_REPRESENTANTE_INVALIDO = 'Representante informado não existe ou não é representante.';
const MENSAGEM_REPRESENTANTE_INATIVO = 'Representante inativo.';
const MENSAGEM_DESTINO_IGUAL_A_ORIGEM = 'Escolha outro representante para receber a carteira.';

export type UsuarioDTO = {
  id: string;
  nome: string;
  usuario: string;
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
    usuario: usuario.usuario,
    telefone: usuario.telefone,
    role: usuario.role,
    ativo: usuario.ativo,
    criadoEm: usuario.criadoEm.toISOString(),
    clientesNaCarteira: usuario._count.clients,
  };
}

function erroUsuarioDuplicado(): AppError {
  return new AppError(ErrorCode.CONFLICT, MENSAGEM_USUARIO_DUPLICADO, 409);
}

/**
 * A checagem prévia (`exigirUsuarioLivre`) dá a mensagem certa no caso comum;
 * esta tradução cobre a corrida em que dois cadastros com o mesmo usuário
 * chegam juntos e o índice único do banco recusa o segundo.
 */
function traduzirUsuarioDuplicado(err: unknown): unknown {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return erroUsuarioDuplicado();
  }
  return err;
}

/** Usuário (já em minúsculas) livre, ou da própria conta que está sendo editada. */
async function exigirUsuarioLivre(usuario: string, idDoProprio?: string): Promise<void> {
  const dono = await userRepository.findByUsuario(usuario);
  if (dono && dono.id !== idDoProprio) {
    throw erroUsuarioDuplicado();
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
  await exigirUsuarioLivre(input.usuario);

  try {
    const criado = await userRepository.create({
      nome: input.nome,
      usuario: input.usuario,
      telefone: input.telefone ?? null,
      role: input.role,
      senhaHash: await hashDaSenha(input.senha),
    });
    return await obterUsuario(criado.id);
  } catch (err) {
    throw traduzirUsuarioDuplicado(err);
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

  if (input.usuario !== undefined) {
    await exigirUsuarioLivre(input.usuario, alvo.id);
  }

  try {
    await userRepository.update(id, input);
  } catch (err) {
    throw traduzirUsuarioDuplicado(err);
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

/**
 * Senha provisória definida pelo gestor (qualquer conta, inclusive a dele e
 * as inativas), com o mesmo hash do cadastro. Não há revogação de JWT: a
 * sessão já aberta da pessoa continua até expirar; o próximo login só entra
 * com a senha nova.
 */
export async function definirSenhaProvisoria(id: string, senha: string): Promise<void> {
  await exigirUsuario(id);
  await userRepository.updateSenha(id, await hashDaSenha(senha));
}
