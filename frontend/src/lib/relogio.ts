/**
 * Relógio do front (relógio de demonstração). Toda leitura de "agora" das
 * telas passa por `agora()`, garantido por `src/arquitetura-relogio.test.ts`.
 * Com `DATA_DE_DEMONSTRACAO` definida no backend, `GET /sistema/relogio`
 * devolve o deslocamento em dias inteiros, que o `useRelogio` aplica aqui
 * (`definirRelogio`) antes de mostrar a tela: o calendário anda na data
 * simulada e o horário do dia continua o real, igual ao backend. O
 * deslocamento vem dos dias da resposta, nunca de `agora` da API menos o
 * relógio do aparelho (a diferença entre os dois relógios vazaria para cá).
 * Fica só em memória (sem `localStorage`); antes de carregar, ou se a
 * chamada falhar (também numa nova busca, ver `useRelogio`), o deslocamento
 * é 0. A faixa "Data simulada" sai da resposta da API na `Moldura`.
 * Usa `Date.now()`, então o relógio
 * falso dos testes (`vi.setSystemTime`) continua valendo.
 */
import type { Relogio } from '../services/sistema';

const DIA_MS = 86_400_000;

let deslocamentoMs = 0;

/** O momento atual no relógio do sistema (real, ou deslocado na demonstração). */
export function agora(): Date {
  return new Date(Date.now() + deslocamentoMs);
}

/** Troca o deslocamento; 0 volta ao relógio real. */
export function definirDeslocamento(ms: number): void {
  deslocamentoMs = ms;
}

/** Aplica a resposta de `GET /sistema/relogio`. */
export function definirRelogio(relogio: Relogio): void {
  definirDeslocamento(relogio.simulado ? relogio.deslocamentoDias * DIA_MS : 0);
}
