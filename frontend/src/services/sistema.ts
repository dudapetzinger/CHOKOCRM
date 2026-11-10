/**
 * Acesso tipado às rotas de sistema, públicas (a tela de login também usa):
 * - `GET /sistema/relogio` (`backend/src/controllers/sistema.controller.ts`):
 *   o relógio do backend, com a data do modo demonstração quando ligado (a
 *   data mora no banco, tabela `configuracoes`).
 * - `POST /sistema/demonstracao`: com a senha da conta Gestão, liga o modo
 *   demonstração numa data (ou o desliga, com `data: null`) e recria a
 *   demonstração; responde `{ relogio }`. Erros: 401 `E-mail ou senha
 *   inválidos`, 403 `Só a conta Gestão pode fazer isso.`, 409 `Já existe uma
 *   recriação em andamento.` Vai por `api.postSemSessao`, sem o token salvo:
 *   o 401 da senha errada não desloga ninguém. Usado pelo painel
 *   `components/ModoDemonstracao.tsx` da tela de login.
 */
import { api } from './api';

export type Relogio = {
  /** O "agora" do backend em ISO (só informativo: o front usa `deslocamentoDias`). */
  agora: string;
  simulado: boolean;
  /** `AAAA-MM-DD` com o modo demonstração ligado; `null` no relógio real. */
  dataDeDemonstracao: string | null;
  /** Dias inteiros entre o dia real de referência e a data da demonstração. */
  deslocamentoDias: number;
  /**
   * `AAAA-MM-DD` do dia real em que a data da demonstração foi definida;
   * `null` no relógio real. Só informativo.
   */
  diaDeReferencia?: string | null;
};

export type DefinirDemonstracaoInput = {
  /** `AAAA-MM-DD`, ou `null` para voltar ao relógio real. */
  data: string | null;
  email: string;
  senha: string;
};

export function buscarRelogio(): Promise<Relogio> {
  return api.get<Relogio>('/sistema/relogio');
}

export function definirDemonstracao(input: DefinirDemonstracaoInput): Promise<{ relogio: Relogio }> {
  return api.postSemSessao<{ relogio: Relogio }>('/sistema/demonstracao', input);
}
