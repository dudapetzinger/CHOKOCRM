/**
 * Acesso tipado às rotas de sistema. Espelha a resposta de
 * `GET /sistema/relogio` (`backend/src/controllers/sistema.controller.ts`,
 * autenticada, qualquer papel): o relógio do backend, com a data de
 * demonstração quando `DATA_DE_DEMONSTRACAO` está definida.
 */
import { api } from './api';

export type Relogio = {
  /** O "agora" do backend em ISO (só informativo: o front usa `deslocamentoDias`). */
  agora: string;
  simulado: boolean;
  /** `AAAA-MM-DD` quando simulado; `null` sem a variável. */
  dataDeDemonstracao: string | null;
  /**
   * Dias inteiros entre a data de demonstração e o dia real de referência
   * (o fixado na variável com `@`, ou o dia em que a API subiu).
   */
  deslocamentoDias: number;
  /**
   * `AAAA-MM-DD` do dia real de referência quando a variável é ancorada
   * (`AAAA-MM-DD@AAAA-MM-DD`); `null` sem âncora. Só informativo.
   */
  diaDeReferencia?: string | null;
};

export function buscarRelogio(): Promise<Relogio> {
  return api.get<Relogio>('/sistema/relogio');
}
