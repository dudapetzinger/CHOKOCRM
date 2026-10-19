/**
 * Acesso tipado aos usuários. `listRepresentantes` (Etapa 7) serve o
 * seletor do gestor e espelha `GET /users?role=REPRESENTANTE` (só os ativos,
 * por nome). O resto é a gestão de usuários do gestor (Etapa 8, spec 7.13):
 * todas as rotas de `/users` são só do gestor no backend.
 */
import type { Role } from '../auth/auth-context';
import { api } from './api';
import { emailValido } from '../lib/email';

export type Representante = { id: string; nome: string };

type ListRepresentantesResponse = { data: Representante[] };

export function listRepresentantes(): Promise<Representante[]> {
  return api.get<ListRepresentantesResponse>('/users?role=REPRESENTANTE').then((resposta) => resposta.data);
}

/** Um usuário na tela de Usuários (`UsuarioDTO` do backend). */
export type Usuario = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: Role;
  ativo: boolean;
  criadoEm: string;
  /** Clientes ativos na carteira dele. */
  clientesNaCarteira: number;
};

/** Sem a confirmação da senha: o backend recusa campos a mais. Sem telefone, o campo não vai. */
export type NovoUsuarioInput = {
  nome: string;
  email: string;
  telefone?: string;
  role: Role;
  senha: string;
};

/** Edição parcial: o que não vier fica como está; `telefone: null` apaga. */
export type AtualizarUsuarioInput = Partial<{
  nome: string;
  email: string;
  telefone: string | null;
  role: Role;
  ativo: boolean;
}>;

/** Todos os usuários, ativos e inativos, por nome. */
export function listarUsuarios(): Promise<Usuario[]> {
  return api.get<{ data: Usuario[] }>('/users').then((resposta) => resposta.data);
}

export function criarUsuario(input: NovoUsuarioInput): Promise<Usuario> {
  return api.post<Usuario>('/users', input);
}

export function atualizarUsuario(id: string, input: AtualizarUsuarioInput): Promise<Usuario> {
  return api.patch<Usuario>(`/users/${id}`, input);
}

/** Passa todos os clientes de `origemId` (ativos e inativos) para um representante ativo. */
export function transferirCarteira(origemId: string, destinoId: string): Promise<{ transferidos: number }> {
  return api.post<{ transferidos: number }>(`/users/${origemId}/transferir-carteira`, { destinoId });
}

/** Manda ao e-mail de cadastro da pessoa o link para ela mesma definir a senha nova. */
export async function enviarRedefinicaoDeSenha(id: string): Promise<void> {
  await api.post<void>(`/users/${id}/redefinicao-de-senha`);
}

/** Nome e e-mail como o formulário os tem (antes de aparar). */
export type DadosUsuarioFormulario = { nome: string; email: string };
export type ErrosDadosUsuario = Partial<Record<keyof DadosUsuarioFormulario, string>>;

/** As mesmas regras do zod do backend (`user.schema.ts`), com as mesmas mensagens. */
export function validarDadosUsuario(dados: DadosUsuarioFormulario): ErrosDadosUsuario {
  const erros: ErrosDadosUsuario = {};
  if (!dados.nome.trim()) erros.nome = 'Nome é obrigatório.';
  if (!emailValido(dados.email)) erros.email = 'E-mail inválido.';
  return erros;
}
